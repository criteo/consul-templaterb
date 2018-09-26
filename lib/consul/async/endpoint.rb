require 'consul/async/utilities'

class Endpoint
  attr_reader :conf, :path, :x_consul_index, :queue, :stats, :last_result, :enforce_json_200, :start_time, :default_value, :query_params
  def initialize(conf, path, enforce_json_200 = true, query_params = {}, default_value = '[]')
    @conf = conf.create(path)
    @default_value = default_value
    @path = path
    @queue = EM::Queue.new
    @s_callbacks = []
    @e_callbacks = []
    @enforce_json_200 = enforce_json_200
    @start_time = Time.now.utc
    @consecutive_errors = 0
    @query_params = query_params
    @stopping = false
    @stats = EndPointStats.new
    @last_result = ConsulResult.new(default_value, false, HttpResponse.new(nil), 0, stats, 1)
    on_response { |result| @stats.on_reponse result }
    on_error { |http| @stats.on_error http }
    _enable_network_debug if conf.debug && conf.debug[:network]
    fetch
    queue << 0
  end

  def _enable_network_debug
    on_response do |result|
      state = result.x_consul_index.to_i < 1 ? '[WARN]' : '[ OK ]'
      stats = result.stats
      STDERR.puts "[DEBUG]#{state}#{result.modified? ? '[MODIFIED]' : '[NO DIFF]'}" \
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

  def build_request(headers = {}, query_params = {})
    req = {
      head: headers,
      path: path,
      query: query_params,
      keepalive: true,
      callback: method(:on_response)
    }
    @query_params.each_pair do |k, v|
      req[:query][k] = v
    end
    req
  end

  def _handle_error(http, consul_index)
    retry_in = [600, conf.retry_duration + 2**@consecutive_errors].min
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
          n_consul_index = find_x_consul_token(http)
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
