require 'spec_helper'
require 'consul/async/consul_endpoint'
require 'consul/async/consul_template'
require 'consul/async/consul_template_render'
require 'webmock/rspec'

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

RSpec.describe Consul::Async::ConsulEndpoint do
  before do
    @conf = Consul::Async::ConsulConfiguration.new
  end

  def mock_path(path)
    body = read("#{path}.json")
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

  it 'returns the right json from the body of the http request' do
    path = 'v1/health/service/consul'
    results = mock_all
    EM.run_block { @endpoint = Consul::Async::ConsulEndpoint.new(@conf, path) }
    expect(@endpoint.ready?).to be true
    expect(@endpoint.last_result.data).to eq results[path]
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
end
