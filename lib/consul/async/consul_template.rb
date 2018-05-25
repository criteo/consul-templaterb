require 'consul/async/utilities'
require 'em-http'
require 'thread'
require 'forwardable'
require 'erb'
module Consul
  module Async
    class InvalidTemplateException < StandardError
      attr_reader :cause
      def initialize(cause)
        @cause = cause
      end
    end

    class SyntaxErrorInTemplate < InvalidTemplateException
      attr_reader :cause
      def initialize(cause)
        @cause = cause
      end
    end

    class ConsulEndPointsManager
      attr_reader :conf, :net_info, :start_time
      def initialize(consul_configuration)
        @conf = consul_configuration
        @endpoints = {}
        @iteration = 1
        @start_time = Time.now.utc
        @net_info = {
          success: 0,
          errors: 0,
          bytes_read: 0
        }
        @context = {
          current_erb_path: nil,
          params: {}
        }
      end

      # https://www.consul.io/api/health.html#list-nodes-for-service
      def service(name, dc: nil, passing: false, tag: nil)
        raise 'You must specify a name for a service' if name.nil?
        path = "/v1/health/service/#{name}"
        query_params = {}
        query_params[:dc] = dc if dc
        query_params[:passing] = passing if passing
        query_params[:tag] = tag if tag
        create_if_missing(path, query_params) { ConsulTemplateService.new(ConsulEndpoint.new(conf, path, true, query_params, '[]')) }
      end

      # https://www.consul.io/api/health.html#list-checks-for-service
      def checks_for_service(name, dc: nil, passing: false)
        raise 'You must specify a name for a service' if name.nil?
        path = "/v1/health/checks/#{name}"
        query_params = {}
        query_params[:dc] = dc if dc
        query_params[:passing] = passing if passing
        create_if_missing(path, query_params) { ConsulTemplateChecks.new(ConsulEndpoint.new(conf, path, true, query_params, '[]')) }
      end

      # https://www.consul.io/api/catalog.html#list-nodes
      def nodes(dc: nil)
        path = '/v1/catalog/nodes'
        query_params = {}
        query_params[:dc] = dc if dc
        create_if_missing(path, query_params) { ConsulTemplateNodes.new(ConsulEndpoint.new(conf, path, true, query_params, '[]')) }
      end

      # https://www.consul.io/api/catalog.html#list-services-for-node
      def node(name_or_id, dc: nil)
        path = "/v1/catalog/node/#{name_or_id}"
        query_params = {}
        query_params[:dc] = dc if dc
        create_if_missing(path, query_params) { ConsulTemplateNodes.new(ConsulEndpoint.new(conf, path, true, query_params, '{}')) }
      end

      # https://www.consul.io/api/agent.html#read-configuration
      def agent_self
        path = '/v1/agent/self'
        query_params = {}
        default_value = '{"Config":{}, "Coord":{}, "Member":{}, "Meta":{}, "Stats":{}}'
        create_if_missing(path, query_params) { ConsulAgentSelf.new(ConsulEndpoint.new(conf, path, true, query_params, default_value)) }
      end

      # https://www.consul.io/api/agent.html#view-metrics
      def agent_metrics
        path = '/v1/agent/metrics'
        query_params = {}
        default_value = '{"Gauges":[], "Points":[], "Member":{}, "Counters":[], "Samples":{}}'
        create_if_missing(path, query_params) { ConsulAgentMetrics.new(ConsulEndpoint.new(conf, path, true, query_params, default_value)) }
      end

      # Return a param of template
      def param(key, default_value = nil)
        v = @context[:params][key]
        v = @context[:params][key.to_sym] unless v
        v = default_value unless v
        v
      end

      # https://www.consul.io/api/catalog.html#list-services
      def services(dc: nil, tag: nil)
        path = '/v1/catalog/services'
        query_params = {}
        query_params[:dc] = dc if dc
        # Tag filtering is performed on client side
        query_params[:tag] = tag if tag
        create_if_missing(path, query_params) { ConsulTemplateServices.new(ConsulEndpoint.new(conf, path, true, query_params, '{}')) }
      end

      # https://www.consul.io/api/catalog.html#list-datacenters
      def datacenters
        path = '/v1/catalog/datacenters'
        query_params = {}
        create_if_missing(path, query_params) { ConsulTemplateDatacenters.new(ConsulEndpoint.new(conf, path, true, query_params, '[]')) }
      end

      # https://www.consul.io/api/kv.html#read-key
      def kv(name = nil, dc: nil, keys: nil, recurse: false)
        path = "/v1/kv/#{name}"
        query_params = {}
        query_params[:dc] = dc if dc
        query_params[:recurse] = recurse if recurse
        query_params[:keys] = keys if keys
        default_value = '[]'
        create_if_missing(path, query_params) { ConsulTemplateKV.new(ConsulEndpoint.new(conf, path, true, query_params, default_value), name) }
      end

      # render a relative file with the given params accessible from template
      def render_file(path, params = {})
        new_path = File.expand_path(path, File.dirname(@context[:current_erb_path]))
        raise "render_file ERROR: #{path} is resolved as #{new_path}, but the file does not exists" unless File.exist? new_path
        render(File.read(new_path), new_path, params)
      end

      def find_line(e)
        return e.message.dup[5..-1] if e.message.start_with? '(erb):'
        e.backtrace.each do |line|
          return line[5..-1] if line.start_with? '(erb):'
        end
        nil
      end

      def render(tpl, tpl_file_path, params = {})
        # Ugly, but allow to use render_file well to support stack of calls
        old_value = @context
        @context = {
          current_erb_path: tpl_file_path,
          params: params
        }
        result = ERB.new(tpl).result(binding)
        @context = old_value
        result
      rescue StandardError => e
        e2 = InvalidTemplateException.new e
        raise e2, "[TEMPLATE EVALUATION ERROR] #{tpl_file_path}#{find_line(e)}: #{e.message}"
      rescue SyntaxError => e
        e2 = SyntaxErrorInTemplate.new e
        raise e2, "[TEMPLATE SYNTAX ERROR] #{tpl_file_path}#{find_line(e)}: #{e.message}"
      end

      def write(file, tpl, last_result, tpl_file_path, params = {})
        data = render(tpl, tpl_file_path, params)
        not_ready = []
        ready = 0
        @iteration = Time.now.utc - @start_time
        to_cleanup = []
        @endpoints.each_pair do |endpoint_key, endpt|
          if endpt.ready?
            ready += 1
          else
            not_ready << endpt.endpoint.path
          end
          to_cleanup << endpoint_key if (@iteration - endpt.seen_at) > 60
        end
        if not_ready.count.positive?
          STDERR.print "[INFO] Waiting for data from #{not_ready.count}/#{not_ready.count + ready} endpoints: #{not_ready[0..2]}..."
          return [false, false, nil]
        end
        if to_cleanup.count > 1
          STDERR.puts "[INFO] Cleaned up #{to_cleanup.count} endpoints: #{to_cleanup}"
          to_cleanup.each do |to_remove|
            x = @endpoints.delete(to_remove)
            x.endpoint.terminate
          end
        end
        if last_result != data
          STDERR.print "[INFO] Write #{Utilities.bytes_to_h data.bytesize} bytes to #{file}, "\
                       "netinfo=#{@net_info} aka "\
                       "#{Utilities.bytes_to_h((net_info[:bytes_read] / (Time.now.utc - @start_time)).round(1))}/s ...\n"
          tmp_file = "#{file}.tmp"
          File.open(tmp_file, 'w') do |f|
            f.write data
          end
          File.rename(tmp_file, file)
        end
        [true, data != last_result, data]
      end

      def terminate
        @endpoints.each_value do |v|
          v.endpoint.terminate
        end
        @endpoints = {}
      end

      def create_if_missing(path, query_params)
        fqdn = path.dup
        query_params.each_pair do |k, v|
          fqdn = "#{fqdn}&#{k}=#{v}"
        end
        tpl = @endpoints[fqdn]
        unless tpl
          tpl = yield
          STDERR.print "[INFO] path #{path.ljust(64)} #{query_params.inspect}\r"
          @endpoints[fqdn] = tpl
          tpl.endpoint.on_response do |result|
            @net_info[:success] = @net_info[:success] + 1
            @net_info[:bytes_read] = @net_info[:bytes_read] + result.data.bytesize
          end
          tpl.endpoint.on_error { @net_info[:errors] = @net_info[:errors] + 1 }
        end
        tpl._seen_at(@iteration)
        tpl
      end
    end

    class ConsulTemplateAbstract
      extend Forwardable
      def_delegators :result_delegate, :each, :[], :sort, :select, :each_value, :count, :empty?
      attr_reader :result, :endpoint, :seen_at
      def initialize(consul_endpoint)
        @endpoint = consul_endpoint
        consul_endpoint.on_response do |res|
          @result = parse_result(res)
        end
        @result = parse_result(consul_endpoint.last_result)
      end

      def _seen_at(val)
        @seen_at = val
      end

      def ready?
        @endpoint.ready?
      end

      protected

      def result_delegate
        result.json
      end

      def parse_result(res)
        res
      end
    end

    class ConsulTemplateAbstractMap < ConsulTemplateAbstract
      def_delegators :result_delegate, :each, :[], :keys, :sort, :values, :each_pair, :each_value
      def initialize(consul_endpoint)
        super(consul_endpoint)
      end
    end

    class ConsulTemplateAbstractArray < ConsulTemplateAbstract
      def initialize(consul_endpoint)
        super(consul_endpoint)
      end
    end

    class ServiceInstance < Hash
      def initialize(obj)
        merge!(obj)
      end

      # Return ['Service']['Address'] if defined, the address of node otherwise
      def service_address
        val = self['Service']['Address']
        val = self['Node']['Address'] unless !val.nil? && val != ''
        val
      end
    end

    class ConsulTemplateService < ConsulTemplateAbstractMap
      def initialize(consul_endpoint)
        super(consul_endpoint)
        @cached_result = []
        @cached_json = nil
      end

      def result_delegate
        return @cached_result if @cached_json == result.json
        new_res = []
        result.json.each do |v|
          new_res << ServiceInstance.new(v)
        end
        @cached_result = new_res
        new_res
      end
    end

    class ConsulTemplateDatacenters < ConsulTemplateAbstractArray
      def initialize(consul_endpoint)
        super(consul_endpoint)
      end
    end

    class ConsulTemplateServices < ConsulTemplateAbstractMap
      def initialize(consul_endpoint)
        super(consul_endpoint)
      end

      def parse_result(res)
        return res unless res.data == '{}' || endpoint.query_params[:tag]
        res_json = JSON.parse(res.data)
        result = {}
        res_json.each do |name, tags|
          result[name] = tags if tags.include? endpoint.query_params[:tag]
        end
        res.mutate(JSON.generate(result))
        res
      end
    end

    class ConsulAgentSelf < ConsulTemplateAbstractMap
      def initialize(consul_endpoint)
        super(consul_endpoint)
      end
    end

    class ConsulAgentMetrics < ConsulTemplateAbstractMap
      def initialize(consul_endpoint)
        super(consul_endpoint)
      end
    end

    class ConsulTemplateChecks < ConsulTemplateAbstractArray
      def initialize(consul_endpoint)
        super(consul_endpoint)
      end
    end

    class ConsulTemplateNodes < ConsulTemplateAbstractArray
      def initialize(consul_endpoint)
        super(consul_endpoint)
      end
    end

    class ConsulTemplateKV < ConsulTemplateAbstractArray
      attr_reader :root
      def initialize(consul_endpoint, root)
        @root = root
        super(consul_endpoint)
      end

      def find(name = root)
        res = result_delegate.find { |k| name == k['Key'] }
        res || {}
      end

      # Get the raw value (might be base64 encoded)
      def get_value(name = root)
        find(name)['Value']
      end

      # Get the Base64 Decoded value
      def get_value_decoded(name = root)
        val = get_value(name)
        return nil unless val
        Base64.decode64(val)
      end

      # Helper to get the value decoded as JSON
      def get_value_json(name = root, catch_errors: true)
        x = get_value_decoded(name)
        return nil unless x
        begin
          JSON.parse(x)
        rescue JSON::ParserError => e
          return nil if catch_errors
          raise StandardError.new(e), "get_value_json() cannot deserialize kv(#{name}) as JSON: #{e.message}", e.backtrace
        end
      end
    end
  end
end
