require 'consul/async/utilities'
require 'consul/async/stats'
require 'em-http'
require 'json'

module Consul
  module Async
    # Configuration to apply to JSONEndpoints
    class JSONConfiguration
      attr_reader :url, :retry_duration, :min_duration, :retry_on_non_diff,
                  :debug, :enable_gzip_compression, :request_method, :json_body,
                  :headers, :tls_cert_chain, :tls_private_key, :tls_verify_peer
      def initialize(url:,
                     debug: { network: false },
                     retry_duration: 10,
                     min_duration: 10,
                     retry_on_non_diff: 10,
                     request_method: :get,
                     json_body: nil,
                     headers: {},
                     enable_gzip_compression: true,
                     tls_cert_chain: nil,
                     tls_private_key: nil,
                     tls_verify_peer: true)
        @url = url
        @debug = debug
        @enable_gzip_compression = enable_gzip_compression
        @retry_duration = retry_duration
        @min_duration = min_duration
        @retry_on_non_diff = retry_on_non_diff
        @request_method = request_method
        @json_body = json_body
        @headers = headers
        @tls_cert_chain = tls_cert_chain
        @tls_private_key = tls_private_key
        @tls_verify_peer = tls_verify_peer
      end

      def create(_url)
        # here we assume we don't need to cache configuration
        self
      end
    end
    # Result from call to a Remote JSON endpoint
    class JSONResult
      attr_reader :data, :http, :last_update, :stats, :retry_in
      def initialize(data, modified, http, stats, retry_in, fake: false)
        @data = data
        @modified = modified
        @http = http
        @last_update = Time.now.utc
        @stats = stats
        @retry_in = retry_in
        @fake = fake
      end

      def fake?
        @fake
      end

      def modified?
        @modified
      end

      def mutate(new_data)
        @data = new_data.dup
        @json = nil
      end

      def json
        @json ||= JSON.parse(data)
      end

      def next_retry_at
        next_retry + last_update
      end
    end
    # Encapsulation of HTTP Response
    class HttpResponse
      attr_reader :response_header, :response, :error
      def initialize(http, override_nil_response = nil)
        if http.nil?
          @response_header = nil
          @response = override_nil_response
          @error = 'Not initialized yet'
        else
          @response_header = http.response_header.nil? ? nil : http.response_header.dup.freeze
          @response = http.response.nil? || http.response.empty? ? override_nil_response : http.response.dup.freeze
          @error = http.error.nil? ? nil : http.error.dup.freeze
        end
      end
    end
    # Endpoint (aka URL) of a remote API that might be called
    class JSONEndpoint
      attr_reader :conf, :url, :queue, :stats, :last_result, :enforce_json_200, :start_time, :default_value, :query_params
      def initialize(conf, url, default_value, enforce_json_200 = true, query_params = {})
        @conf = conf.create(url)
        @default_value = default_value
        @url = url
        @queue = EM::Queue.new
        @s_callbacks = []
        @e_callbacks = []
        @enforce_json_200 = enforce_json_200
        @start_time = Time.now.utc
        @consecutive_errors = 0
        @query_params = query_params
        @stopping = false
        @stats = EndPointStats.new
        @last_result = JSONResult.new(default_value.to_json, false, HttpResponse.new(nil), stats, 1, fake: true)
        on_response { |result| @stats.on_response result }
        on_error { |http| @stats.on_error http }
        _enable_network_debug if conf.debug && conf.debug[:network]
        fetch
        queue << Object.new
      end

      def _enable_network_debug
        on_response do |result|
          stats = result.stats
          warn "[DBUG][ OK ]#{result.modified? ? '[MODFIED]' : '[NO DIFF]'}" \
          "[s:#{stats.successes},err:#{stats.errors}]" \
          "[#{stats.body_bytes_human.ljust(8)}][#{stats.bytes_per_sec_human.ljust(9)}]"\
          " #{url.ljust(48)}, next in #{result.retry_in} s"
        end
        on_error { |http| warn "[ERROR]: #{url}: #{http.error.inspect}" }
      end

      def on_response(&block)
        @s_callbacks << block
      end

      def on_error(&block)
        @e_callbacks << block
      end

      def ready?
        @ready
      end

      def terminate
        @stopping = true
      end

      private

      def build_request
        res = {
          head: {
            'Accept' => 'application/json'
          },
          url: url,
          keepalive: true,
          callback: method(:on_response)
        }
        if conf.json_body
          res[:body] = conf.json_body.to_json
          res[:head]['Content-Type'] = 'application/json'
        end
        res[:head]['accept-encoding'] = 'identity' unless conf.enable_gzip_compression
        conf.headers.map do |k, v|
          res[:head][k] = v
        end
        @query_params.each_pair do |k, v|
          res[:query][k] = v
        end
        res
      end

      def _compute_retry_in(retry_in)
        retry_in / 2 + Consul::Async::Utilities.random.rand(retry_in)
      end

      def _handle_error(http)
        retry_in = _compute_retry_in([600, conf.retry_duration + 2**@consecutive_errors].min)
        ::Consul::Async::Debug.puts_error "[#{url}] - #{http.error} - Retry in #{retry_in}s #{stats.body_bytes_human}"
        @consecutive_errors += 1
        http_result = HttpResponse.new(http)
        EventMachine.add_timer(retry_in) do
          yield
          queue.push(Object.new)
        end
        @e_callbacks.each { |c| c.call(http_result) }
      end

      def fetch
        options = {
          tls: { verify_peer: conf.tls_verify_peer },
          connect_timeout: 5, # default connection setup timeout
          inactivity_timeout: 60 # default connection inactivity (post-setup) timeout
        }
        unless conf.tls_cert_chain.nil?
          options[:tls] = {
            cert_chain_file: conf.tls_cert_chain,
            private_key_file: conf.tls_private_key,
            verify_peer: conf.tls_verify_peer
          }
        end
        connection = {
          conn: EventMachine::HttpRequest.new(conf.url, options)
        }
        cb = proc do
          request_method = conf.request_method.to_sym
          http = connection[:conn].send(request_method, build_request)
          http.callback do
            if enforce_json_200 && !(200..299).cover?(http.response_header.status) && http.response_header['Content-Type'] != 'application/json'
              _handle_error(http) do
                warn "[RETRY][#{url}] (#{@consecutive_errors} errors)" if (@consecutive_errors % 10) == 1
              end
            else
              @consecutive_errors = 0
              http_result = HttpResponse.new(http)
              new_content = http_result.response.freeze
              modified = @last_result.fake? || @last_result.data != new_content
              retry_in = modified ? conf.min_duration : conf.retry_on_non_diff
              retry_in = _compute_retry_in(retry_in)
              retry_in = 0.1 if retry_in < 0.1
              unless @stopping
                EventMachine.add_timer(retry_in) do
                  queue.push(Object.new)
                end
              end
              result = JSONResult.new(new_content, modified, http_result, stats, retry_in, fake: false)
              @last_result = result
              @ready = true
              @s_callbacks.each { |c| c.call(result) }
            end
          end

          http.errback do
            unless @stopping
              _handle_error(http) do
                if (@consecutive_errors % 10) == 1
                  add_msg = http.error
                  if Gem.win_platform? && http.error.include?('unable to create new socket: Too many open files')
                    add_msg += "\n *** Windows does not support more than 2048 watches, watch less endpoints ***"
                  end
                  ::Consul::Async::Debug.puts_error "[RETRY][#{url}] (#{@consecutive_errors} errors) due to #{add_msg}"
                end
              end
            end
          end
          queue.pop(&cb)
        end
        queue.pop(&cb)
      end
    end
  end
end
