require 'spec_helper'
require 'consul/async/consul_template_engine'
require_relative 'async_mock'

RSpec.describe Consul::Async::ConsulTemplateEngine do
  include Consul::AsyncMock
  before do
    @conf = Consul::Async::ConsulConfiguration.new
  end

  it 'Renders properly basic.erb' do
    mock_all
    EM.run_block do
      template_manager = Consul::Async::ConsulEndPointsManager.new(@conf)
      template_file = find_absolute_path('../../../../samples/ha_proxy.cfg.erb')
      output_file = 'out.txt'
      @renderer = Consul::Async::ConsulTemplateRender.new(template_manager, template_file, output_file)
      @renderer.run
    end
    EM.run_block do
      @renderer.run
    end
    expect(@renderer.render).to eq read 'samples/haproxy.cfg'
  end
end
