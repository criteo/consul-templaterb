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

      def render_file(path)
        new_path = File.expand_path(path, File.dirname(@current_erb_path))
        raise "render_file ERROR: #{path} is resolved as #{new_path}, but the file does not exists" unless File.exist? new_path
        render(File.read(new_path), new_path)
      end

      def render(tpl, tpl_file_path)
        # Ugly, but allow to use render_file well to support stack of calls
        old_value = @current_erb_path
        @current_erb_path = tpl_file_path
        result = ERB.new(tpl).result(binding)
        @current_erb_path = old_value
        result
      rescue StandardError => e
        e2 = InvalidTemplateException.new e
        raise e2, "Template contains errors: #{e.message}", e.backtrace
      end

      def write(file, tpl, last_result, tpl_file_path)
        data = render(tpl, tpl_file_path)
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
          to_cleanup << endpoint_key if (@iteration - endpt.seen_at) > 10
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
      def_delegators :result_delegate, :each, :[], :sort, :each_value, :count, :empty?
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

    class ConsulTemplateService < ConsulTemplateAbstractMap
      def initialize(consul_endpoint)
        super(consul_endpoint)
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
      def get_value_json(name = root)
        x = get_value_decoded(name)
        return nil unless x
        JSON.parse(x)
      end
    end
  end
end
