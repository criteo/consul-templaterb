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
      stub_request(:get, "http://locahost:8500/#{path}?index=0&stale=stale&tag=http&wait=600s")
        .to_return(body: body, status: 200)
      stub_request(:get, "http://locahost:8500/#{path}?index=0&stale=stale&wait=600s")
        .to_return(body: body, status: 200)
      body
    end

    def mock_all
      results = {}
      %w(v1/catalog/nodes v1/catalog/services v1/health/service/consul).each do |path|
        results[path] = mock_path path
      end
      results
    end
  end
end
