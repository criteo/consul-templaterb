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

    def mock_path(path)
      body = read("#{path}.json")
      stub_request(:get, %r{http://locahost:8500/#{path}?.*})
        .to_return(body: body, status: 200)
      body
    end

    def mock_all
      results = {}
      %w(v1/agent/metrics
         v1/agent/self
         v1/catalog/datacenters
         v1/catalog/nodes
         v1/catalog/services
         v1/health/checks/consul
         v1/health/service/consul
         v1/kv/
         v1/kv/choregraphies
         v1/kv/services-data/web-preview/network-service).each do |path|
        results[path] = mock_path path
      end
      results
    end
  end
end
