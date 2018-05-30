require 'spec_helper'
require 'consul/async/consul_endpoint'
require_relative 'async_mock'

RSpec.describe Consul::Async::VaultEndpoint do
  include Consul::AsyncMock
  before do
    @conf = Consul::Async::VaultConfiguration.new()
  end

  it 'returns the right json from the body of the http request' do
    path = 'v1/test/foo'
    results = mock_vault
    EM.run_block { @endpoint = Consul::Async::VaultEndpoint.new(@conf, path) }
    expect(@endpoint.ready?).to be true
    puts results
    expect(@endpoint.last_result.data).to eq results[path]
  end
end
