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

    def mock_path(path, file, port, http_method = :get, status = 200, query_params={})
      body = read(file)
      stub_request(http_method, %r{http://localhost:#{port}/#{path}?.*})
          .to_return(body: body, status: status)
      body
    end

    def mock_consul_path(path)
      mock_path(path, "consul/#{path}.json", 8500, :get)
    end

    def mock_vault
      results = {}
      [
          ['v1/test/foo', :get, 200],
          ['v1/test/nothere', :get, 404],
      ].each do |path, verb, code|
        results[path] = mock_path(path, "vault/#{path}.json", 8200, verb, code )
      end
      results
    end

    def mock_consul
      results = {}
      %w[v1/agent/metrics
         v1/agent/self
         v1/catalog/datacenters
         v1/catalog/nodes
         v1/catalog/node/consul02-par.central.criteo.preprod
         v1/catalog/node/7a985997-3925-4f18-8613-637c81bd750b
         v1/catalog/services
         v1/health/checks/consul
         v1/health/service/consul
         v1/kv/
         v1/kv/choregraphies
         v1/kv/services-data/web-preview/network-service].each do |path|
        results[path] = mock_consul_path path
      end
      results
    end

  end
end
