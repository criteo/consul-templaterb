require 'consul/async/utilities'
require 'em-http'
require 'forwardable'
require 'erb'
require 'digest'

module Consul
  module Async
    # Exception thrown when a template is invalid and cause a Runtime Exception during
    # its rendering
    class InvalidTemplateException < StandardError
      attr_reader :cause
      def initialize(cause)
        @cause = cause
      end
    end

    # Exception thrown when the template is Invalid due to a Syntax Error
    class SyntaxErrorInTemplate < InvalidTemplateException
      attr_reader :cause
      def initialize(cause)
        @cause = cause
      end
    end

    # Class to handle the retrival of a Remote resource (such a JSON API)
    class RemoteResource
      def initialize(endpoints_manager)
        @endp_manager = endpoints_manager
      end

      def as_json(url, default_value, refresh_delay_secs: 10, default_value_on_error: false, **opts)
        conf = JSONConfiguration.new(url: url, min_duration: refresh_delay_secs, retry_on_non_diff: refresh_delay_secs, **opts)
        endpoint_id = url + opts.hash.to_s
        @endp_manager.create_if_missing(url, {}, endpoint_id: endpoint_id) do
          if default_value.is_a?(Array)
            ConsulTemplateJSONArray.new(JSONEndpoint.new(conf, url, default_value, default_value_on_error: default_value_on_error))
          else
            ConsulTemplateJSONObject.new(JSONEndpoint.new(conf, url, default_value, default_value_on_error: default_value_on_error))
          end
        end
      end
    end

    # Encapsulation of endpoints to get coordinates
    class Coordinate
      def initialize(endpoints_manager)
        @endp_manager = endpoints_manager
      end

      # Return the coordinates of datacenters
      def datacenters(dc: nil, agent: nil)
        path = '/v1/coordinate/datacenters'
        query_params = {}
        query_params[:dc] = dc if dc
        @endp_manager.create_if_missing(path, query_params, agent: agent) do
          ConsulTemplateNodes.new(ConsulEndpoint.new(@endp_manager.consul_conf, path, true, query_params, '[]', agent))
        end
      end

      # Returns the coordinates for all nodes of DC
      def nodes(dc: nil, agent: nil)
        path = '/v1/coordinate/nodes'
        query_params = {}
        query_params[:dc] = dc if dc
        @endp_manager.create_if_missing(path, query_params, agent: agent) do
          ConsulTemplateNodes.new(ConsulEndpoint.new(@endp_manager.consul_conf, path, true, query_params, '[]', agent))
        end
      end

      # Computes the RTT between 2 nodes
      def rtt(a, b)
        # Calculate the Euclidean distance plus the heights.
        a_vec = a['Vec']
        b_vec = b['Vec']
        sumsq = 0.0
        a_vec.count.times do |i|
          diff = a_vec[i] - b_vec[i]
          sumsq += diff * diff
        end
        rtt = Math.sqrt(sumsq) + a['Height'] + b['Height']

        adjusted = rtt + a['Adjustment'] + b['Adjustment']
        rtt = adjusted if adjusted.positive?
        rtt
      end
    end

    # This class keep references over all endpoints (aka datasources) registered for all templates.
    # This allows reusing those endpoints as well as performing listing and garbage collecting.
    # This is also the main object visible from ERB files which contains all methods available
    # to template writters.
    class EndPointsManager
      attr_reader :consul_conf, :vault_conf, :running, :net_info, :start_time, :coordinate, :remote_resource, :templates
      def initialize(consul_configuration, vault_configuration, templates, trim_mode = nil)
        @running = true
        @consul_conf = consul_configuration
        @vault_conf = vault_configuration
        @trim_mode = trim_mode
        @endpoints = {}
        @iteration = 1
        @start_time = Time.now.utc
        @last_debug_time = 0
        @net_info = {
          success: 0,
          errors: 0,
          bytes_read: 0,
          changes: 0,
          network_bytes: 0
        }
        @templates = templates
        @context = {
          current_erb_path: nil,
          template_info: {
            'source_root' => nil,
            'source' => nil,
            'destination' => nil,
            'was_rendered_once' => false
          },
          params: {}
        }
        @max_consecutive_errors_on_endpoint = consul_configuration.max_consecutive_errors_on_endpoint || 10
        @fail_fast_errors = consul_configuration.fail_fast_errors
        @coordinate = Coordinate.new(self)
        @remote_resource = RemoteResource.new(self)

        # Setup token renewal
        vault_setup_token_renew unless @vault_conf.token.nil? || !@vault_conf.token_renew
      end

      # https://www.consul.io/api/health.html#list-nodes-for-service
      def service(name, dc: nil, passing: false, tag: nil, agent: nil)
        raise 'You must specify a name for a service' if name.nil?

        path = '/v1/health/service/' + ERB::Util.url_encode(name.to_s)
        query_params = {}
        query_params[:dc] = dc if dc
        query_params[:passing] = passing if passing
        query_params[:tag] = tag if tag
        create_if_missing(path, query_params, agent: agent) { ConsulTemplateService.new(ConsulEndpoint.new(consul_conf, path, true, query_params, '[]', agent)) }
      end

      # https://www.consul.io/api/health.html#list-checks-for-service
      def checks_for_service(name, dc: nil, passing: false, agent: nil)
        raise 'You must specify a name for a service' if name.nil?

        path = '/v1/health/checks/' + ERB::Util.url_encode(name.to_s)
        query_params = {}
        query_params[:dc] = dc if dc
        query_params[:passing] = passing if passing
        create_if_missing(path, query_params, agent: agent) { ConsulTemplateChecks.new(ConsulEndpoint.new(consul_conf, path, true, query_params, '[]', agent)) }
      end

      # https://www.consul.io/api/health.html#list-checks-for-node
      def checks_for_node(name, dc: nil, passing: false, agent: nil)
        raise 'You must specify a name for a service' if name.nil?

        path = '/v1/health/node/' + ERB::Util.url_encode(name.to_s)
        query_params = {}
        query_params[:dc] = dc if dc
        query_params[:passing] = passing if passing
        create_if_missing(path, query_params, agent: agent) { ConsulTemplateChecks.new(ConsulEndpoint.new(consul_conf, path, true, query_params, '[]', agent)) }
      end

      # https://www.consul.io/api-docs/health#list-checks-in-state
      # Supported in Consul 1.7+
      def checks_in_state(check_state, dc: nil, agent: nil)
        valid_checks_states = %w[any critical passing warning]
        raise "checks_in_state('#{check_state}'...) must be one of #{valid_checks_states}" unless valid_checks_states.include?(check_state)

        path = "/v1/health/state/#{check_state}"
        query_params = {}
        query_params[:dc] = dc if dc
        create_if_missing(path, query_params, agent: agent) { ConsulTemplateChecks.new(ConsulEndpoint.new(consul_conf, path, true, query_params, '[]', agent)) }
      end

      # https://www.consul.io/api/catalog.html#list-nodes
      def nodes(dc: nil, agent: nil)
        path = '/v1/catalog/nodes'
        query_params = {}
        query_params[:dc] = dc if dc
        create_if_missing(path, query_params, agent: agent) { ConsulTemplateNodes.new(ConsulEndpoint.new(consul_conf, path, true, query_params, '[]', agent)) }
      end

      # https://www.consul.io/api/catalog.html#list-services-for-node
      def node(name_or_id, dc: nil, agent: nil)
        path = '/v1/catalog/node/' + ERB::Util.url_encode(name_or_id.to_s)
        query_params = {}
        query_params[:dc] = dc if dc
        create_if_missing(path, query_params, agent: agent) { ConsulTemplateNode.new(ConsulEndpoint.new(consul_conf, path, true, query_params, '{}', agent)) }
      end

      # https://www.consul.io/api/agent.html#read-configuration
      def agent_self(agent: nil)
        path = '/v1/agent/self'
        query_params = {}
        default_value = '{"Config":{}, "Coord":{}, "Member":{}, "Meta":{}, "Stats":{}}'
        create_if_missing(path, query_params, agent: agent) { ConsulAgentSelf.new(ConsulEndpoint.new(consul_conf, path, true, query_params, default_value, agent)) }
      end

      # https://www.consul.io/api/agent.html#view-metrics
      def agent_metrics(agent: nil)
        path = '/v1/agent/metrics'
        query_params = {}
        default_value = '{"Gauges":[], "Points":[], "Member":{}, "Counters":[], "Samples":{}}'
        create_if_missing(path, query_params, agent: agent) { ConsulAgentMetrics.new(ConsulEndpoint.new(consul_conf, path, true, query_params, default_value, agent)) }
      end

      # https://www.consul.io/api/agent.html#list-members
      def agent_members(wan: false, agent: nil)
        path = '/v1/agent/members'
        query_params = {}
        query_params['wan'] = true if wan
        default_value = '[]'
        create_if_missing(path, query_params, agent: agent) { ConsulTemplateMembers.new(ConsulEndpoint.new(consul_conf, path, true, query_params, default_value, agent)) }
      end

      # Return a param of template
      def param(key, default_value = nil)
        v = @context[:params][key]
        v ||= @context[:params][key.to_sym]
        v ||= default_value
        v
      end

      # Get information about current template
      def template_info
        @context[:template_info]
      end

      # https://www.consul.io/api/catalog.html#list-services
      def services(dc: nil, tag: nil, agent: nil)
        path = '/v1/catalog/services'
        query_params = {}
        query_params[:dc] = dc if dc
        # Tag filtering is performed on client side
        query_params[:tag] = tag if tag
        create_if_missing(path, query_params, agent: agent) { ConsulTemplateServices.new(ConsulEndpoint.new(consul_conf, path, true, query_params, '{}', agent)) }
      end

      # https://www.consul.io/api/catalog.html#list-datacenters
      def datacenters(agent: nil)
        path = '/v1/catalog/datacenters'
        query_params = {}
        create_if_missing(path, query_params, agent: agent) { ConsulTemplateDatacenters.new(ConsulEndpoint.new(consul_conf, path, true, query_params, '[]', agent)) }
      end

      # https://www.consul.io/api/kv.html#read-key
      def kv(name = nil, dc: nil, keys: nil, recurse: false, agent: nil)
        path = '/v1/kv/' + ERB::Util.url_encode(name.to_s)
        query_params = {}
        query_params[:dc] = dc if dc
        query_params[:recurse] = recurse if recurse
        query_params[:keys] = keys if keys
        default_value = '[]'
        create_if_missing(path, query_params, agent: agent) { ConsulTemplateKV.new(ConsulEndpoint.new(consul_conf, path, true, query_params, default_value, agent), name) }
      end

      def secrets(path = '', agent: nil)
        raise "You need to provide a vault token to use 'secret' keyword" if vault_conf.token.nil?

        path = "/v1/#{path}".gsub(%r{/{2,}}, '/')
        query_params = { list: 'true' }
        create_if_missing(path, query_params,
                          fail_fast_errors: vault_conf.fail_fast_errors,
                          max_consecutive_errors_on_endpoint: vault_conf.max_consecutive_errors_on_endpoint,
                          agent: agent) do
          ConsulTemplateVaultSecretList.new(VaultEndpoint.new(vault_conf, path, 'GET', true, query_params, JSON.generate(data: { keys: [] }), agent: agent))
        end
      end

      def secret(path = '', post_data = nil, agent: nil)
        raise "You need to provide a vault token to use 'secret' keyword" if vault_conf.token.nil?

        path = "/v1/#{path}".gsub(%r{/{2,}}, '/')
        query_params = {}
        method = post_data ? 'POST' : 'GET'
        create_if_missing(path, query_params,
                          fail_fast_errors: vault_conf.fail_fast_errors,
                          max_consecutive_errors_on_endpoint: vault_conf.max_consecutive_errors_on_endpoint,
                          agent: agent) do
          ConsulTemplateVaultSecret.new(VaultEndpoint.new(vault_conf, path, method, true, query_params, JSON.generate(data: {}), agent: agent))
        end
      end

      # render a relative file with the given params accessible from template
      def render_file(path, params = {})
        new_path = File.expand_path(path, File.dirname(@context[:current_erb_path]))
        raise "render_file ERROR: #{path} is resolved as #{new_path}, but the file does not exists" unless File.exist? new_path

        render(File.read(new_path), new_path, params, current_template_info: template_info)
      end

      # render a sub template from a string template
      def render_from_string(template_content, params = {})
        return unless template_content

        sha1res = Digest::SHA1.hexdigest(template_content)
        new_path = File.expand_path(":memory:sha1:#{sha1res}", File.dirname(@context[:current_erb_path]))
        render(template_content, new_path, params, current_template_info: template_info)
      end

      def find_line(e)
        return e.message.dup[5..-1] if e.message.start_with? '(erb):'

        e.backtrace.each do |line|
          return line[5..-1] if line.start_with? '(erb):'
        end
        nil
      end

      def render(tpl, tpl_file_path, params = {}, current_template_info: nil)
        # Ugly, but allow to use render_file well to support stack of calls
        old_value = @context
        tpl_info = current_template_info.merge('source' => tpl_file_path.freeze)
        @context = {
          current_erb_path: tpl_file_path,
          params: params,
          template_info: tpl_info
        }
        result = ERB.new(tpl, nil, @trim_mode).result(binding)
        raise "Result is not a string :='#{result}' for #{tpl_file_path}" unless result.is_a?(String)

        @context = old_value
        result
      rescue StandardError => e
        e2 = InvalidTemplateException.new e
        raise e2, "[TEMPLATE EVALUATION ERROR] #{tpl_file_path}#{find_line(e)}: #{e.message}"
      rescue SyntaxError => e
        e2 = SyntaxErrorInTemplate.new e
        raise e2, "[TEMPLATE SYNTAX ERROR] #{tpl_file_path}#{find_line(e)}: #{e.message}"
      end

      def write(file, tpl, last_result, tpl_file_path, params = {}, current_template_info: {})
        @iteration = Time.now.utc - @start_time
        data = render(tpl, tpl_file_path, params, current_template_info: current_template_info)
        not_ready = []
        ready = 0
        to_cleanup = []
        @endpoints.each_pair do |endpoint_key, endpt|
          if endpt.ready?
            ready += 1
          else
            # We consider only the endpoints usefull with current iteration
            not_ready << endpoint_key unless endpt.seen_at < @iteration
          end
          to_cleanup << endpoint_key if (@iteration - endpt.seen_at) > 60
        end
        if not_ready.count.positive? || data.nil?
          if @iteration - @last_debug_time > 1
            @last_debug_time = @iteration
            if data.nil?
              ::Consul::Async::Debug.print_info "Waiting for Template #{tpl_file_path} to not return nil, consider it not ready...\r"
            else
              ::Consul::Async::Debug.print_info "Waiting for data from #{not_ready.count}/#{not_ready.count + ready} endpoints: #{not_ready[0..2]}...\r"
            end
          end
          return [false, false, nil]
        end
        if to_cleanup.count > 1
          ::Consul::Async::Debug.puts_info "Cleaned up #{to_cleanup.count} endpoints: #{to_cleanup}"
          to_cleanup.each do |to_remove|
            x = @endpoints.delete(to_remove)
            x.endpoint.terminate
          end
        end
        if last_result != data
          ::Consul::Async::Debug.print_info "Write #{Utilities.bytes_to_h data.bytesize} bytes to #{file}, "\
                       "netinfo=#{@net_info} aka "\
                       "#{Utilities.bytes_to_h((net_info[:network_bytes] / (Time.now.utc - @start_time)).round(1))}/s ...\r"
          tmp_file = "#{file}.tmp"
          begin
            File.open(tmp_file, 'w') do |f|
              f.write data
            end
            File.rename(tmp_file, file)
          rescue StandardError => e
            ::Consul::Async::Debug.puts_error "Failed  writting #{Utilities.bytes_to_h data.bytesize} bytes to #{file}: #{e.class}, message: #{e.inspect}"
          end
        end
        [true, data != last_result, data]
      end

      def terminate
        @running = false
        @endpoints.each_value do |v|
          v.endpoint.terminate
        end
        @endpoints = {}
      end

      def vault_setup_token_renew
        path = 'v1/auth/token/renew-self'
        ::Consul::Async::Debug.print_debug 'Setting up vault token renewal'
        VaultEndpoint.new(vault_conf, path, :POST, {}, {})
      end

      def create_if_missing(path, query_params, fail_fast_errors: @fail_fast_errors,
                            max_consecutive_errors_on_endpoint: @max_consecutive_errors_on_endpoint,
                            agent: nil, endpoint_id: nil)
        endpoint_id ||= begin
                          fqdn = path.dup
                          fqdn = "#{agent}#{fqdn}"
                          query_params.each_pair do |k, v|
                            fqdn += "&#{k}=#{v}"
                          end
                          fqdn
                        end
        tpl = @endpoints[endpoint_id]
        unless tpl
          tpl = yield
          ::Consul::Async::Debug.print_debug "path #{path.ljust(64)} #{query_params.inspect}\r"
          @endpoints[endpoint_id] = tpl
          tpl.endpoint.on_response do |result|
            @net_info[:success] += 1
            @net_info[:bytes_read] += result.data.bytesize
            @net_info[:changes] += 1 if result.modified?
            @net_info[:network_bytes] += result.http.response_header['Content-Length'].to_i
          end
          tpl.endpoint.on_error do |_err|
            @net_info[:errors] = @net_info[:errors] + 1
            if tpl.endpoint.stats.successes.zero? && fail_fast_errors
              ::Consul::Async::Debug.puts_error "Endpoint #{path} is failing at first call with fail fast activated, terminating..."
              terminate
            end
            if tpl.endpoint.stats.consecutive_errors > max_consecutive_errors_on_endpoint
              ::Consul::Async::Debug.puts_error "Endpoint #{path} has too many consecutive errors: #{tpl.endpoint.stats.consecutive_errors}, terminating..."
              terminate
            end
          end
        end
        tpl._seen_at(@iteration)
        tpl
      end
    end

    # Abstract class that stores information about a result
    class ConsulTemplateAbstract
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

      def method_missing(method_name, *args, &block)
        if result_delegate.respond_to?(method_name)
          result_delegate.send(method_name, *args, &block)
        else
          super
        end
      end

      def respond_to_missing?(method_name, *args)
        result_delegate.respond_to?(method_name, *args)
      end

      protected

      def result_delegate
        result.json.freeze
      end

      def parse_result(res)
        res
      end
    end

    # Concrete class of a result when the result is a JSON Object
    class ConsulTemplateAbstractMap < ConsulTemplateAbstract
      def initialize(consul_endpoint)
        super(consul_endpoint)
      end
    end

    # Concrete class of a result when the result is a JSON Array
    class ConsulTemplateAbstractArray < ConsulTemplateAbstract
      def initialize(consul_endpoint)
        super(consul_endpoint)
      end
    end

    # technically this class could be also an array, a simple string or any simple json object other than a hash.
    class ConsulTemplateAbstractJSONObject < ConsulTemplateAbstractMap; end

    # Just another name
    class ConsulTemplateAbstractJSONArray < ConsulTemplateAbstractArray; end

    # The ServiceInstance has shortcuts (such as service_address method), but is
    # basically a Hash.
    class ServiceInstance < Hash
      def initialize(obj)
        merge!(obj)
      end

      # Return ['Node']['Meta']
      def node_meta
        self['Node']['Meta'] || {}
      end

      # Return ['Service']['Address'] if defined, the address of node otherwise
      def service_address
        val = self['Service']['Address']
        val = self['Node']['Address'] unless !val.nil? && val != ''
        val
      end

      # Return a defined hash of string valued Service.Meta
      def service_meta
        self['Service']['Meta'] || {}
      end

      # If given key exists in Service.Meta returns it, otherwise the same key from
      # return Node.Meta, otherwise return nil
      def service_or_node_meta_value(key)
        service_meta[key] || node_meta[key]
      end

      # Return the global state of a Service, will return passing|warning|critical
      def status
        ret = 'passing'
        checks = self['Checks']
        return ret unless checks

        checks.each do |chk|
          st = chk['Status']
          if st == 'critical'
            ret = st
          elsif st == 'warning' && ret == 'passing'
            ret = st
          end
        end
        ret
      end

      # Return Consul weights even if Consul version < 1.2.3 with same semantics
      def weights
        self['Service']['Weights'] || { 'Passing' => 1, 'Warning' => 1 }
      end

      # Return the weights applied on instance according to current status
      def current_weight
        current_status = status
        weights[current_status.capitalize] || 0
      end
    end

    # Representation as a Map of a Service (includes Service, Node, Checks)
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
        @cached_json = result.json
        new_res
      end
    end

    # Object returned by datacenters(), basically a JSON Array
    class ConsulTemplateDatacenters < ConsulTemplateAbstractArray
      def initialize(consul_endpoint)
        super(consul_endpoint)
      end
    end

    # Object returned by services() an abstract map of service_name, tags
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

    # Another name to handle backwards compatibility
    class ConsulTemplateJSONObject < ConsulTemplateAbstractJSONObject; end

    # Another name to handle backwards compatibility
    class ConsulTemplateJSONArray < ConsulTemplateAbstractJSONArray; end

    # Object returned by /v1/agent/self, a JSON Map
    class ConsulAgentSelf < ConsulTemplateAbstractMap
      def initialize(consul_endpoint)
        super(consul_endpoint)
      end
    end

    # Object returning metrics from Consul agent, a JSON Map
    class ConsulAgentMetrics < ConsulTemplateAbstractMap
      def initialize(consul_endpoint)
        super(consul_endpoint)
      end
    end

    # List of checks for agent
    class ConsulTemplateChecks < ConsulTemplateAbstractArray
      def initialize(consul_endpoint)
        super(consul_endpoint)
      end
    end

    # Get information about a single node
    class ConsulTemplateNode < ConsulTemplateAbstractMap
      def initialize(consul_endpoint)
        super(consul_endpoint)
      end

      def exists?
        !result_delegate.nil?
      end

      def safe_get
        if exists?
          result_delegate
        else
          {
            'Node': {},
            'Services': {}
          }
        end
      end

      def node
        safe_get['Node'] || {}
      end

      def services
        safe_get['Services'] || {}
      end
    end

    # List of nodes of the whole cluster
    class ConsulTemplateNodes < ConsulTemplateAbstractArray
      def initialize(consul_endpoint)
        super(consul_endpoint)
      end
    end

    # The ServiceInstance has shortcuts (such as service_address method), but is
    # basically a Hash.
    class SerfMember < Hash
      def initialize(obj)
        merge!(obj)
      end

      # List the possible Serf statuses as text, indexed by self['Status']
      def serf_statuses
        %w[none alive leaving left failed].freeze
      end

      # Return status as text
      def status
        serf_statuses[self['Status']] || "unknownStatus:#{self['Status']}"
      end
    end

    # List of serf members of the whole cluster
    class ConsulTemplateMembers < ConsulTemplateAbstractArray
      def initialize(consul_endpoint)
        super(consul_endpoint)
      end

      def result_delegate
        return @cached_result if @cached_json == result.json

        new_res = []
        result.json.each do |v|
          new_res << SerfMember.new(v)
        end
        @cached_result = new_res
        @cached_json = result.json
        new_res
      end
    end

    # Key/Values representations
    # This is an array as it might contain several values
    # Several helpers exist to handle nicely transformations
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

      # Helper to get the value decoded as YAML
      def get_value_yaml(name = root, catch_errors: true)
        x = get_value_decoded(name)
        return nil unless x

        begin
          YAML.safe_load(x)
        rescue YAML::ParserError => e
          return nil if catch_errors

          raise StandardError.new(e), "get_value_yaml() cannot deserialize kv(#{name}) as YAML: #{e.message}", e.backtrace
        end
      end
    end

    # Vault Secrets is a Map of secrets properly decoded
    class ConsulTemplateVaultSecret < ConsulTemplateAbstractMap
      def initialize(vault_endpoint)
        super(vault_endpoint)
      end
    end

    # Array of available secrets
    class ConsulTemplateVaultSecretList < ConsulTemplateAbstractArray
      def parse_result(res)
        return res if res.data.nil?

        res.mutate(JSON.generate(res.json['data']['keys']))
        res
      end
    end
  end
end
