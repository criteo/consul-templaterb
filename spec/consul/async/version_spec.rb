require 'spec_helper'
require 'consul/async/consul_endpoint'

RSpec.describe Consul::Async do
  it 'has a version number' do
    expect(Consul::Async::VERSION).not_to be nil
  end
end
