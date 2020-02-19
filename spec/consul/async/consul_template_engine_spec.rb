require 'spec_helper'
require 'consul/async/consul_template_engine'
require_relative 'async_mock'

RSpec.describe Consul::Async::ConsulTemplateEngine do
  include Consul::AsyncMock
  before do
    @consul_conf = Consul::Async::ConsulConfiguration.new
    @vault_conf = Consul::Async::VaultConfiguration.new(token: 'fake', token_renew: false)
  end

  it 'Renders properly ha_proxy.cfg.erb' do
    mock_consul
    EM.run_block do
      template_file = find_absolute_path('../../../../samples/ha_proxy.cfg.erb')
      output_file = 'out.txt'
      template_manager = Consul::Async::EndPointsManager.new(@consul_conf, @vault_conf, [[template_file, output_file, {}]])
      @renderer = Consul::Async::ConsulTemplateRender.new(template_manager, template_file, output_file)
      @renderer.run
    end
    EM.run_block do
      @renderer.run
    end
    expect(@renderer.render).to eq read 'samples/haproxy.cfg'
  end

  samples_path = File.expand_path('../../../samples', __dir__)

  it "Expects samples (#{samples_path}) is a valid directory" do
    expect(File.directory?(samples_path)).to be true
  end

  Dir.glob(File.join(samples_path, '**', '*.erb')).each do |erb|
    it "Checks that #{erb} do work" do
      mock_consul
      mock_vault
      mock_json
      EM.run_block do
        template_file = erb
        output_file = 'out.txt'
        template_manager = Consul::Async::EndPointsManager.new(@consul_conf, @vault_conf, [[template_file, output_file, {}]])
        @renderer = Consul::Async::ConsulTemplateRender.new(template_manager, template_file, output_file)
      end
      # For multi-pass templates, we wait for up to 3 iterations
      3.times do
        @renderer.run
      end
      expect(@renderer.render).not_to be_empty
    end
  end
end
