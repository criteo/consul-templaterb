require 'consul/async/utilities'
require 'em-http'
require 'thread'
require 'erb'
module Consul
  module Async
    class ConsulEndPointsManager
      attr_reader :conf, :net_info
      def initialize(consul_configuration, template)
        @conf = consul_configuration
        @endpoints = {}
        @iteration = 1
        @template = template
        @last_result = ''
        @start_time = Time.now.utc
        @net_info = {
          success: 0,
          errors: 0,
          bytes_read: 0
        }
      end

      def service(name, dc: nil, passing: false, tag: nil)
        raise 'You must specify a name for a service' if name.nil?
        path = "/v1/health/service/#{name}"
        query_params = {}
        query_params[:dc] = dc if dc
        query_params[:passing] = passing if passing
        query_params[:tag] = tag if tag
        create_if_missing(path, query_params) { ConsulTemplateService.new(ConsulEndpoint.new(conf, path, true, query_params, '[]')) }
      end

      def checks_for_service(name, dc: nil, passing: false, tag: nil)
        raise 'You must specify a name for a service' if name.nil?
        path = "/v1/health/checks/#{name}"
        query_params = {}
        query_params[:dc] = dc if dc
        query_params[:passing] = passing if passing
        query_params[:tag] = tag if tag
        create_if_missing(path, query_params) { ConsulTemplateChecks.new(ConsulEndpoint.new(conf, path, true, query_params, '[]')) }
      end

      def nodes(dc: nil, tag: nil)
        path = '/v1/catalog/nodes'
        query_params = {}
        query_params[:dc] = dc if dc
        query_params[:tag] = tag if tag
        create_if_missing(path, query_params) { ConsulTemplateNodes.new(ConsulEndpoint.new(conf, path, true, query_params, '[]')) }
      end

      def services(dc: nil, tag: nil)
        path = '/v1/catalog/services'
        query_params = {}
        query_params[:dc] = dc if dc
        query_params[:tag] = tag if tag
        create_if_missing(path, query_params) { ConsulTemplateServices.new(ConsulEndpoint.new(conf, path, true, query_params, '{}')) }
      end

      def datacenters
        path = '/v1/catalog/datacenters'
        query_params = {}
        create_if_missing(path, query_params) { ConsulTemplateDatacenters.new(ConsulEndpoint.new(conf, path, true, query_params, '{}')) }
      end

      def kv(name = nil, dc: nil, keys: nil, recurse: false)
        path = "/v1/kv/#{name}"
        query_params = {}
        query_params[:dc] = dc if dc
        query_params[:recurse] = recurse if recurse
        query_params[:keys] = keys if keys
        default_value = '[]'
        create_if_missing(path, query_params) { ConsulTemplateKV.new(ConsulEndpoint.new(conf, path, true, query_params, default_value)) }
      end

      def render(tpl = @template)
        ERB.new(tpl).result(binding)
      end

      def update_template(new_template)
        if new_template != @template
          render(new_template)
          @template = new_template.freeze
        end
      end

      def write(file)
        data = render
        not_ready = 0
        ready = 0
        @iteration += 1
        to_cleanup = []
        @endpoints.each_value do |tpl|
          if tpl.ready?
            ready += 1
          else
            not_ready += 1
          end
          to_cleanup << tpl if (@iteration - tpl.seen_at) > 30
        end
        if not_ready.positive?
          STDERR.print "[INFO] Waiting for data from #{not_ready}/#{not_ready + ready} endpoints...\r"
          return false
        end
        if to_cleanup.count > 1
          STDERR.puts "[INFO] Candidates for cleanup: #{to_cleanup}..."
          # TODO: cleanup old endpoints
        end
        if @last_result != data
          STDERR.print "[INFO] Write #{Utilities.bytes_to_h data.bytesize} bytes to #{file}, "\
                       "netinfo=#{@net_info} aka "\
                       "#{Utilities.bytes_to_h((net_info[:bytes_read] / (Time.now.utc - @start_time) ).round(1))}/s ...\r"
          File.open(file, 'w') do |f|
            f.write data
          end
          @last_result = data
        end
        true
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
          STDERR.print "[INFO] path #{path.ljust(64)} #{query_params.inspect} \r"
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
      attr_reader :endpoint, :seen_at
      def initialize(consul_endpoint)
        @endpoint = consul_endpoint
        consul_endpoint.on_response do |res|
          @ready = true
          @result = res
        end
        @result = consul_endpoint.last_result
        @ready = consul_endpoint.ready?
      end

      def _seen_at(val)
        @seen_at = val
      end

      attr_reader :result

      def ready?
        @ready
      end
    end

    class ConsulTemplateService < ConsulTemplateAbstract
      def initialize(consul_endpoint)
        super(consul_endpoint)
      end
    end

    class ConsulTemplateDatacenters < ConsulTemplateAbstract
      def initialize(consul_endpoint)
        super(consul_endpoint)
      end
    end

    class ConsulTemplateServices < ConsulTemplateAbstract
      def initialize(consul_endpoint)
        super(consul_endpoint)
      end
    end

    class ConsulTemplateChecks < ConsulTemplateAbstract
      def initialize(consul_endpoint)
        super(consul_endpoint)
      end
    end

    class ConsulTemplateNodes < ConsulTemplateAbstract
      def initialize(consul_endpoint)
        super(consul_endpoint)
      end
    end

    class ConsulTemplateKV < ConsulTemplateAbstract
      def initialize(consul_endpoint)
        super(consul_endpoint)
      end
    end
  end
end
