require 'consul/async/utilities'
require 'consul/async/stats'
require 'em-http'
require 'thread'
require 'json'
module Consul
  module Async
    class ConsulConfiguration
      attr_reader :base_url, :token, :retry_duration, :min_duration, :wait_duration, :max_retry_duration, :retry_on_non_diff,
                  :missing_index_retry_time_on_diff, :missing_index_retry_time_on_unchanged, :debug, :enable_gzip_compression
      def initialize(base_url: 'http://localhost:8500',
                     debug: { network: false },
                     token: nil,
                     retry_duration: 10,
                     min_duration: 0.1,
                     retry_on_non_diff: 5,
                     wait_duration: 600,
                     max_retry_duration: 600,
                     missing_index_retry_time_on_diff: 15,
                     missing_index_retry_time_on_unchanged: 60,
                     enable_gzip_compression: true,
                     paths: {})
        @base_url = base_url
        @token = token
        @debug = debug
        @enable_gzip_compression = enable_gzip_compression
        @retry_duration = retry_duration
        @min_duration = min_duration
        @wait_duration = wait_duration
        @max_retry_duration = max_retry_duration
        @retry_on_non_diff = retry_on_non_diff
        @missing_index_retry_time_on_diff = missing_index_retry_time_on_diff
        @missing_index_retry_time_on_unchanged = missing_index_retry_time_on_unchanged
        @paths = paths
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
        ConsulConfiguration.new(base_url: ch(path, :base_url),
                                debug: ch(path, :debug),
                                token: ch(path, :token),
                                retry_duration: ch(path, :retry_duration),
                                min_duration: ch(path, :min_duration),
                                retry_on_non_diff: ch(path, :retry_on_non_diff),
                                wait_duration: ch(path, :wait_duration),
                                max_retry_duration: ch(path, :max_retry_duration),
                                missing_index_retry_time_on_diff: ch(path, :missing_index_retry_time_on_diff),
                                missing_index_retry_time_on_unchanged: ch(path, :missing_index_retry_time_on_unchanged),
                                enable_gzip_compression: enable_gzip_compression,
                                paths: @paths)
      end
    end
    class ConsulResult
      attr_reader :data, :http, :x_consul_index, :last_update, :stats, :retry_in
      def initialize(data, modified, http, x_consul_index, stats, retry_in)
        @data = data
        @modified = modified
        @http = http
        @x_consul_index = x_consul_index
        @last_update = Time.now.utc
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
    class ConsulEndpoint
      attr_reader :conf, :path, :x_consul_index, :queue, :stats, :last_result, :enforce_json_200, :start_time, :default_value, :query_params
      def initialize(conf, path, enforce_json_200 = true, query_params = {}, default_value = '[]')
        @conf = conf.create(path)
        @default_value = default_value
        @path = path
        @queue = EM::Queue.new
        @x_consul_index = 0
        @s_callbacks = []
        @e_callbacks = []
        @enforce_json_200 = enforce_json_200
        @start_time = Time.now.utc
        @consecutive_errors = 0
        @query_params = query_params
        @stopping = false
        @stats = EndPointStats.new
        @last_result = ConsulResult.new(default_value, false, HttpResponse.new(nil), 0, stats, 1)
        on_response { |result| @stats.on_response result }
        on_error { |http| @stats.on_error http }
        _enable_network_debug if conf.debug && conf.debug[:network]
        fetch
        queue << 0
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
        on_error { |http| STDERR.puts "[ERROR]: #{path}: #{http.error.inspect}" }
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

      def build_request(consul_index)
        res = {
          head: {
            'Accept'         => 'application/json',
            'X-Consul-Index' => consul_index,
            'X-Consul-Token' => conf.token
          },
          path: path,
          query: {
            wait: "#{conf.wait_duration}s",
            index: consul_index,
            stale: 'stale'
          },
          keepalive: true,
          callback: method(:on_response)
        }
        res[:head]['accept-encoding'] = 'identity' unless conf.enable_gzip_compression
        @query_params.each_pair do |k, v|
          res[:query][k] = v
        end
        res
      end

      def find_x_consul_index(http)
        http.response_header['X-Consul-Index']
      end

      def _compute_retry_in(retry_in)
        retry_in / 2 + Consul::Async::Utilities.random.rand(retry_in)
      end

      def _handle_error(http, consul_index)
        retry_in = _compute_retry_in([600, conf.retry_duration + 2**@consecutive_errors].min)
        STDERR.puts "[ERROR][#{path}] X-Consul-Index:#{consul_index} - #{http.error} - Retry in #{retry_in}s #{stats.body_bytes_human}"
        @consecutive_errors += 1
        http_result = HttpResponse.new(http)
        EventMachine.add_timer(retry_in) do
          yield
          queue.push(consul_index)
        end
        @e_callbacks.each { |c| c.call(http_result) }
      end

      def fetch
        options = {
          connect_timeout: 5, # default connection setup timeout
          inactivity_timeout: conf.wait_duration + 1, # default connection inactivity (post-setup) timeout
        }
        connection = EventMachine::HttpRequest.new(conf.base_url, options)
        cb = proc do |consul_index|
          http = connection.get(build_request(consul_index))
          http.callback do
            # Dirty hack, but contrary to other path, when key is not present, Consul returns 404
            is_kv_empty = path.start_with?('/v1/kv') && http.response_header.status == 404
            if !is_kv_empty && enforce_json_200 && http.response_header.status != 200 && http.response_header['Content-Type'] != 'application/json'
              _handle_error(http, consul_index) { connection = EventMachine::HttpRequest.new(conf.base_url, options) }
            else
              n_consul_index = find_x_consul_index(http)
              @x_consul_index = n_consul_index.to_i if n_consul_index
              @consecutive_errors = 0
              http_result = if is_kv_empty
                              HttpResponse.new(http, default_value)
                            else
                              HttpResponse.new(http)
                            end
              new_content = http_result.response.freeze
              modified = @last_result.nil? ? true : @last_result.data != new_content
              if n_consul_index == consul_index || n_consul_index.nil?
                retry_in = modified ? conf.missing_index_retry_time_on_diff : conf.missing_index_retry_time_on_unchanged
                n_consul_index = consul_index
              else
                retry_in = modified ? conf.min_duration : conf.retry_on_non_diff
              end
              retry_in = _compute_retry_in(retry_in)
              retry_in = 0.1 if retry_in < 0.1
              unless @stopping
                EventMachine.add_timer(retry_in) do
                  queue.push(n_consul_index)
                end
              end
              result = ConsulResult.new(new_content, modified, http_result, n_consul_index, stats, retry_in)
              @last_result = result
              @ready = true
              @s_callbacks.each { |c| c.call(result) }
            end
          end

          http.errback do
            unless @stopping
              _handle_error(http, consul_index) { connection = EventMachine::HttpRequest.new(conf.base_url, options) }
            end
          end
          queue.pop(&cb)
        end
        queue.pop(&cb)
      end
    end
  end
end
