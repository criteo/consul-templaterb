require 'consul/async/utilities'
require 'consul/async/stats'
require 'consul/async/debug'
require 'em-http'
require 'net/http'
require 'json'

module Consul
  module Async
    # Configuration for Vault Endpoints
    class VaultConfiguration
      attr_reader :base_url, :token, :token_renew, :retry_duration, :min_duration, :wait_duration, :max_retry_duration, :retry_on_non_diff,
                  :lease_duration_factor, :debug, :max_consecutive_errors_on_endpoint, :fail_fast_errors

      def initialize(base_url: 'http://localhost:8200',
                     debug: { network: false },
                     token: nil,
                     token_renew: true,
                     retry_duration: 10,
                     min_duration: 0.1,
                     lease_duration_factor: 0.5,
                     max_retry_duration: 600,
                     paths: {},
                     max_consecutive_errors_on_endpoint: 10,
                     fail_fast_errors: false)
        @base_url = base_url
        @token_renew = token_renew
        @debug = debug
        @retry_duration = retry_duration
        @min_duration = min_duration
        @max_retry_duration = max_retry_duration
        @lease_duration_factor = lease_duration_factor
        @paths = paths
        @token = token
        @max_consecutive_errors_on_endpoint = max_consecutive_errors_on_endpoint
        @fail_fast_errors = fail_fast_errors
      end

      def ch(path, symbol)
        sub = @paths[path.to_sym]
        if sub && sub[symbol]
          ::Consul::Async::Debug.puts_info "Overriding #{symbol}:=#{sub[symbol]} for #{path}"
          sub[symbol]
        else
          method(symbol).call
        end
      end

      def create(path, agent: nil)
        return self unless @paths[path.to_sym]

        base_url = ch(path, :base_url)
        if agent
          agent = "http://#{agent}" unless agent.start_with? 'http', 'https'
          base_url = agent
        end
        VaultConfiguration.new(base_url: base_url,
                               debug: ch(path, :debug),
                               token: ch(path, :token),
                               retry_duration: ch(path, :retry_duration),
                               min_duration: ch(path, :min_duration),
                               max_retry_duration: ch(path, :max_retry_duration),
                               lease_duration_factor: ch(path, :lease_duration_factor),
                               paths: @paths,
                               max_consecutive_errors_on_endpoint: @max_consecutive_errors_on_endpoint,
                               fail_fast_errors: @fail_fast_errors)
      end
    end
    # Keep information about Vault result of a query
    class VaultResult
      attr_reader :data, :http, :stats, :retry_in

      def initialize(result, modified, stats, retry_in)
        @data = result.response
        @modified = modified
        @http = result
        @data_json = result.json
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

      def [](path)
        json[path]
      end

      def json
        @data_json = JSON.parse(data) if @data_json.nil?
        @data_json
      end
    end

    # VaultHttpResponse supports empty results (when no data has been received yet)
    class VaultHttpResponse
      attr_reader :response_header, :response, :error, :json

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
        @json = JSON[response]
      end
    end

    # Endpoint in vault (a path in Vault)
    class VaultEndpoint
      attr_reader :conf, :path, :http_method, :queue, :stats, :last_result, :enforce_json_200, :start_time, :default_value, :query_params

      def initialize(conf, path, http_method = 'GET', enforce_json_200 = true, query_params = {}, default_value = '{}', post_data = {}, agent: nil)
        @conf = conf.create(path, agent: agent)
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
        @last_result = VaultResult.new(VaultHttpResponse.new(nil, default_value), false, stats, 1)
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
          warn "[DBUG]#{state}#{result.modified? ? '[MODFIED]' : '[NO DIFF]'}" \
          "[s:#{stats.successes},err:#{stats.errors}]" \
          "[#{stats.body_bytes_human.ljust(8)}][#{stats.bytes_per_sec_human.ljust(9)}]"\
          " #{path.ljust(48)} idx:#{result.x_consul_index}, next in #{result.retry_in} s"
        end
        on_error { |http| ::Consul::Async::Debug.puts_error "#{path}: #{http.error}" }
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
        result.json['lease_duration'] || conf.min_duration
      end

      def _get_errors(http)
        return [http.error] if http.error

        unless http.json.nil?
          return http.json['errors'] if http.json.key?('errors')
        end
        ['unknown error']
      end

      def _handle_error(http)
        retry_in = [conf.max_retry_duration, conf.retry_duration + 2**@consecutive_errors].min
        ::Consul::Async::Debug.puts_error "[#{path}][#{http_method}] Code: #{http.response_header.status} #{_get_errors(http).join(' - ')} - Retry in #{retry_in}s"
        @consecutive_errors += 1
        http_result = VaultHttpResponse.new(http, default_value)
        EventMachine.add_timer(retry_in) do
          yield
          queue.push(0)
        end
        @e_callbacks.each { |c| c.call(http_result) }
      end

      def fetch
        options = {
          connect_timeout: 5, # default connection setup timeout
          inactivity_timeout: 1 # default connection inactivity (post-setup) timeout
        }
        connection = EventMachine::HttpRequest.new(conf.base_url, options)
        cb = proc do |_|
          http = connection.send(http_method.downcase, build_request) # Under the hood: c.send('get', {stuff}) === c.get({stuff})
          http.callback do
            http_result = VaultHttpResponse.new(http.dup.freeze, default_value)
            if enforce_json_200 && http.response_header.status != 200
              _handle_error(http_result) { connection = EventMachine::HttpRequest.new(conf.base_url, options) }
            else
              @consecutive_errors = 0
              modified = @last_result.nil? ? true : @last_result.data != http_result.response # Leaving it do to stats with this later
              retry_in = get_lease_duration(http_result) * conf.lease_duration_factor
              retry_in = [retry_in, conf.max_retry_duration].min
              retry_in = [retry_in, conf.min_duration].max
              result = VaultResult.new(http_result, modified, stats, retry_in)
              unless @stopping
                EventMachine.add_timer(retry_in) do
                  queue.push(0)
                end
              end
              @last_result = result
              @ready = true
              @s_callbacks.each { |c| c.call(result) }
            end
          end

          http.errback do
            _handle_error(http) { connection = EventMachine::HttpRequest.new(conf.base_url, options) } unless @stopping
          end
          queue.pop(&cb)
        end
        queue.pop(&cb)
      end
    end
  end
end
