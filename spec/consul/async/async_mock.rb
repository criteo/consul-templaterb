require 'webmock/rspec'

module Consul
  module AsyncMock
    def find_absolute_path(name)
      File.expand_path("../resources/#{name}", __FILE__)
    end

    def read(name)
      File.read find_absolute_path(name)
    end

    def read_json(name)
      input = read(name)
      JSON.parse input
    end

    def mock_path(path, file, port, http_method = :get, status = 200, _query_params = {})
      body = read(file)
      stub_request(http_method, %r{^http://localhost:#{port}/#{path}(?:\?.*)?$})
        .to_return(body: body, status: status)
      body
    end

    def mock_consul_path(path)
      mock_path(path, "consul/#{path}.json", 8500, :get)
    end

    def mock_vault
      results = {}
      [
        ['v1/test/foo', :get, 200, nil],
        ['v1/test/nothere', :get, 404, nil],
        ['v1/teams/', :get, 200, { list: 'true' }],
        ['v1/auth/ldap/users/', :get, 200, { list: 'true' }],
        ['v1/auth/ldap/users/d.vador', :get, 200],
        ['v1/auth/ldap/groups/', :get, 200, { list: 'true' }],
        ['v1/auth/token/renew-self', :post, 200]
      ].each do |path, verb, code, _query_params|
        results[path] = mock_path(path, "vault/#{path}.json", 8200, verb, code)
      end
      results
    end

    def mock_consul
      results = {}
      %w[v1/agent/metrics
         v1/agent/self
         v1/catalog/datacenters
         v1/catalog/nodes
         v1/catalog/node/consul02.prod
         v1/catalog/node/7a985997-3925-4f18-8613-637c81bd750b
         v1/catalog/services
         v1/coordinate/datacenters
         v1/coordinate/nodes
         v1/health/checks/consul
         v1/health/service/consul
         v1/kv/
         v1/kv/choregraphie
         v1/kv/template-in-template/return-10
         v1/kv/yaml/test.yml
         v1/kv/json/test.json
         v1/kv/services-data/web-preview/network-service].each do |path|
        results[path] = mock_consul_path path
      end
      results
    end

    def mock_json
      stub_request(:get, 'https://rubygems.org/api/v1/versions/consul-templaterb.json')
        .to_return(body: read_json('rubygems_org_consul_templaterb.json').to_json, status: 200)
    end
  end
end
