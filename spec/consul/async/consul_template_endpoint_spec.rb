require 'spec_helper'
require 'consul/async/consul_endpoint'
require_relative 'async_mock'

RSpec.describe Consul::Async::ConsulEndpoint do
  include Consul::AsyncMock
  before do
    @conf = Consul::Async::ConsulConfiguration.new
  end

  it 'returns the right json from the body of the http request' do
    path = 'v1/health/service/consul'
    results = mock_all
    EM.run_block { @endpoint = Consul::Async::ConsulEndpoint.new(@conf, path) }
    expect(@endpoint.ready?).to be true
    expect(@endpoint.last_result.data).to eq results[path]
  end
end
