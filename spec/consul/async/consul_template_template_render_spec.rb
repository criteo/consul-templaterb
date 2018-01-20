require 'spec_helper'
require 'consul/async/consul_template_render'
require_relative 'async_mock'

RSpec.describe Consul::Async::ConsulTemplateRender do
  include Consul::AsyncMock
  before do
    @conf = Consul::Async::ConsulConfiguration.new
  end

  it 'Basic Rendering of Services and tags' do
    mock_all
    EM.run_block do
      template_manager = Consul::Async::ConsulEndPointsManager.new(@conf)
      template_file = find_absolute_path('templates/unit_services.erb')
      @template_value = read('templates/unit_services.erb')
      output_file = find_absolute_path('templates/unit_services.txt.result')
      @renderer = Consul::Async::ConsulTemplateRender.new(template_manager, template_file, output_file)
      @renderer.run
    end
    expect(@renderer.render).to eq read 'templates/unit_services.txt.expected'
  end

  it 'Basic Rendering of Service and tag filtering' do
    mock_all
    EM.run_block do
      template_manager = Consul::Async::ConsulEndPointsManager.new(@conf)
      template_file = find_absolute_path('templates/unit_service.erb')
      @template_value = read('templates/unit_service.erb')
      output_file = find_absolute_path('templates/unit_service.txt.result')
      @renderer = Consul::Async::ConsulTemplateRender.new(template_manager, template_file, output_file)
      @renderer.run
    end
    expect(@renderer.render).to eq read 'templates/unit_service.txt.expected'
  end

  it 'Basic Rendering of Nodes' do
    mock_all
    EM.run_block do
      template_manager = Consul::Async::ConsulEndPointsManager.new(@conf)
      template_file = find_absolute_path('templates/unit_nodes.erb')
      @template_value = read('templates/unit_nodes.erb')
      output_file = find_absolute_path('templates/unit_nodes.txt.result')
      @renderer = Consul::Async::ConsulTemplateRender.new(template_manager, template_file, output_file)
      @renderer.run
    end
    expect(@renderer.render).to eq read 'templates/unit_nodes.txt.expected'
  end

  it 'Basic Rendering of service consul' do
    mock_all
    EM.run_block do
      template_manager = Consul::Async::ConsulEndPointsManager.new(@conf)
      template_file = find_absolute_path('templates/unit_consul.erb')
      @template_value = read('templates/unit_consul.erb')
      output_file = find_absolute_path('templates/unit_consul.txt.result')
      @renderer = Consul::Async::ConsulTemplateRender.new(template_manager, template_file, output_file)
      @renderer.run
    end
    expect(@renderer.render).to eq read 'templates/unit_consul.txt.expected'
  end

  it 'Basic Rendering of checks for service consul' do
    mock_all
    EM.run_block do
      template_manager = Consul::Async::ConsulEndPointsManager.new(@conf)
      template_file = find_absolute_path('templates/unit_checks_for_service.erb')
      @template_value = read('templates/unit_checks_for_service.erb')
      output_file = find_absolute_path('templates/unit_checks_for_service.txt.result')
      @renderer = Consul::Async::ConsulTemplateRender.new(template_manager, template_file, output_file)
      @renderer.run
    end
    expect(@renderer.render).to eq read 'templates/unit_checks_for_service.txt.expected'
  end
end
