require 'spec_helper'
require 'consul/async/consul_template_render'
require_relative 'async_mock'

RSpec.describe Consul::Async::ConsulTemplateRender do
  include Consul::AsyncMock
  before do
    @consul_conf = Consul::Async::ConsulConfiguration.new
    @vault_conf = Consul::Async::VaultConfiguration.new(token: 'fake')
  end

  unit_templates = File.expand_path('resources/templates', __dir__)

  it "Expects unit_templates (#{unit_templates}) is a valid directory" do
    expect(File.directory?(unit_templates)).to be true
  end

  Dir.glob(File.join(unit_templates, '**', '*.erb')).each do |erb|
    expected = erb.gsub(/\.erb$/, '.txt.expected')
    it "Checks that #{erb} renders #{expected}" do
      mock_consul
      mock_vault
      mock_json
      EM.run_block do
        template_file = erb
        @template_value = File.read(template_file)
        output_file = erb.gsub(/\.erb$/, '.txt')
        template_manager = Consul::Async::EndPointsManager.new(@consul_conf, @vault_conf, [[template_file, output_file, {}, { 'ready' => false }]])
        @renderer = Consul::Async::ConsulTemplateRender.new(template_manager, template_file, output_file)
        @renderer.run
      end
      # For multi-pass templates, we wait for up to 3 iterations
      3.times do
        EM.run_block do
          @renderer.run
        end
      end
      expect(@renderer.render).not_to be_empty
      expect(@renderer.render).to eq File.read expected
    end
  end
end
