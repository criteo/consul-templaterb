require 'consul/async/utilities'
require 'consul/async/stats'
require 'em-http'
require 'net/http'
require 'thread'
require 'json'

module Consul
  module Async
    class VaultConfiguration
      attr_reader :base_url, :token, :token_renew, :retry_duration, :min_duration, :wait_duration, :max_retry_duration, :retry_on_non_diff,
                  :lease_duration_factor, :debug

      def initialize(base_url: 'http://localhost:8200',
                     debug: { network: false },
                     token: nil,
                     token_renew: true,
                     retry_duration: 10,
                     min_duration: 0.1,
                     lease_duration_factor: 0.5,
                     max_retry_duration: 600,
                     paths: {})
        @base_url = base_url
        @token_renew = token_renew
        @debug = debug
        @retry_duration = retry_duration
        @min_duration = min_duration
        @max_retry_duration = max_retry_duration
        @lease_duration_factor = lease_duration_factor
        @paths = paths
        @token = token

      end

      def ch(path, symbol)
        sub = @paths[path.to_sym]
        if sub && sub[symbol]
          STDERR.puts "[INFO] Overriding #{symbol}:=#{sub[symbol]} for #{path}"
          sub[symbol]
        else
          method(symbol).call
        end
      end

      def create(path)
        return self unless @paths[path.to_sym]
        VaultConfiguration.new(base_url: ch(path, :base_url),
                               debug: ch(path, :debug),
                               token: ch(path, :token),
                               retry_duration: ch(path, :retry_duration),
                               min_duration: ch(path, :min_duration),
                               max_retry_duration: ch(path, :max_retry_duration),
                               lease_duration_factor: ch(path, :lease_duration_factor),
                               paths: @paths)
      end
    end
    class VaultResult
      attr_reader :data, :http, :stats, :retry_in

      def initialize(data, modified, http, stats, retry_in)
        @data = data
        @modified = modified
        @http = http
        @last_update = Time.now.utc
        @next_update = Time.now.utc + retry_in
        @stats = stats
        @retry_in = retry_in
      end

      def modified?
        @modified
      end

      def mutate(new_data)
        @data = new_data.dup
        @data_json = nil
      end

      def json
        @data_json = JSON.parse(data) if @data_json.nil?
        @data_json
      end

      def next_retry_at
        next_retry + last_update
      end
    end
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
    class VaultEndpoint
      attr_reader :conf, :path, :http_method, :queue, :stats, :last_result, :enforce_json_200, :start_time, :default_value, :query_params

      def initialize(conf, path, http_method = 'GET', enforce_json_200 = true, query_params = {}, default_value = '[]', post_data ={})
        @conf = conf.create(path)
        @default_value = default_value
        @path = path
        @http_method = http_method
        @queue = EM::Queue.new
        @x_consul_index = 0
        @s_callbacks = []
        @e_callbacks = []
        @enforce_json_200 = enforce_json_200
        @start_time = Time.now.utc
        @consecutive_errors = 0
        @query_params = query_params
        @post_data = post_data
        @stopping = false
        @stats = EndPointStats.new
        @last_result = VaultResult.new(default_value, false, HttpResponse.new(nil) , stats ,1)
        on_response { |result| @stats.on_response result }
        on_error { |http| @stats.on_error http }
        _enable_network_debug if conf.debug && conf.debug[:network]
        fetch
        queue.push 0
      end

      def _enable_network_debug
        on_response do |result|
          state = result.x_consul_index.to_i < 1 ? '[WARN]' : '[ OK ]'
          stats = result.stats
          STDERR.puts "[DBUG]#{state}#{result.modified? ? '[MODFIED]' : '[NO DIFF]'}" \
          "[s:#{stats.successes},err:#{stats.errors}]" \
          "[#{stats.body_bytes_human.ljust(8)}][#{stats.bytes_per_sec_human.ljust(9)}]"\
          " #{path.ljust(48)} idx:#{result.x_consul_index}, next in #{result.retry_in} s"
        end
        on_error { |http| STDERR.puts "[ERROR]: #{path}: #{http.error}" }
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

      def build_request()
        res = {
          head: {
            'Accept' => 'application/json',
            'X-Vault-Token' => conf.token
          },
          query: {},
          path: path,
          keepalive: true,
          callback: method(:on_response)
        }
        # if @post_data
        #   res[:body] = JSON.generate(@post_data)
        # end
        @query_params.each_pair do |k, v|
          res[:query][k] = v
        end
        res
      end

      def get_lease_duration(result)
        JSON[result]['lease_duration'] || conf.min_duration
      end
      def _get_errors(http)
        return [http.error] if http.error
        if Utilities.valid_json?(http.response)
          r = JSON[http.response]
          if r.has_key?('errors')
            return r['errors']
          end
        end
        ['unknown error']
      end

      def _handle_error(http)
        retry_in = [conf.max_retry_duration, conf.retry_duration + 2**@consecutive_errors].min
        STDERR.puts "[ERROR][#{path}][#{http_method}] #{_get_errors(http).join(' - ')} - Retry in #{retry_in}s #{stats.body_bytes_human}"
        @consecutive_errors += 1
        http_result = HttpResponse.new(http)
        EventMachine.add_timer(retry_in) do
          yield
          queue.push()
        end
        @e_callbacks.each { |c| c.call(http_result) }
      end

      def fetch
        options = {
          connect_timeout: 5, # default connection setup timeout
          inactivity_timeout: 1, # default connection inactivity (post-setup) timeout
        }
        connection = EventMachine::HttpRequest.new(conf.base_url, options)
        cb = proc do |n|
          http = connection.send(http_method.downcase, build_request()) # Under the hood: c.send('get', {stuff}) === c.get({stuff})
          http.callback do
            if enforce_json_200 && http.response_header.status != 200
              _handle_error(http) { connection = EventMachine::HttpRequest.new(conf.base_url, options) }
            else
              @consecutive_errors = 0
              http_result = HttpResponse.new(http, default_value)
              new_content = http_result.response.freeze
              modified = @last_result.nil? ? true : @last_result.data != new_content # Leaving it do to stats with this later
              retry_in = get_lease_duration(new_content) * conf.lease_duration_factor
              retry_in = [retry_in, conf.max_retry_duration].min
              retry_in = [retry_in, conf.min_duration].max
              unless @stopping
                EventMachine.add_timer(retry_in) do
                  queue.push(0)
                end
              end
              result = VaultResult.new(new_content, modified, http_result, stats, retry_in)
              @last_result = result
              @ready = true
              @s_callbacks.each { |c| c.call(result) }
            end
          end

          http.errback do
            unless @stopping
              _handle_error(http) { connection = EventMachine::HttpRequest.new(conf.base_url, options) }
            end
          end
          queue.pop(&cb)
        end
        queue.pop(&cb)
      end
    end
  end
end
