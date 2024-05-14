# frozen_string_literal: true

require 'rspec'
require 'spec_helper'
require 'consul/async/json_endpoint'
require 'webmock/rspec'

RSpec.describe Consul::Async do
  context 'default parameters' do
    it 'request 200' do
      mock_url = 'http://perfectly.working.url'
      conf = Consul::Async::JSONConfiguration.new(url: mock_url)
      default_value = '[]'

      json_endpoint = nil
      response_body = %w[a b]
      stub_request(:get, mock_url)
        .to_return(body: response_body.to_json, status: 200)
      EM.run_block do
        json_endpoint = Consul::Async::JSONEndpoint.new(conf, mock_url, default_value)
      end
      expect(json_endpoint.ready?).to eq(true)
      expect(json_endpoint.last_result.data).to eq(response_body.to_json)
    end

    it 'request 500' do
      mock_url = 'http://error.working.url'
      conf = Consul::Async::JSONConfiguration.new(url: mock_url)
      default_value = ''

      json_endpoint = nil
      stub_request(:get, mock_url)
        .to_return(body: '', status: 500)
      EM.run_block do
        json_endpoint = Consul::Async::JSONEndpoint.new(conf, mock_url, default_value)
      end
      expect(json_endpoint.ready?).to_not eq(true)
      expect(json_endpoint.last_result.retry_in).to be_positive
    end

    it 'on timeout' do
      mock_url = 'http://not.working.url'
      conf = Consul::Async::JSONConfiguration.new(url: mock_url)
      default_value = ''

      stub_request(:get, mock_url).to_timeout
      json_endpoint = nil
      EM.run_block do
        json_endpoint = Consul::Async::JSONEndpoint.new(conf, mock_url, default_value, enforce_json_200: true)
      end
      expect(json_endpoint.ready?).to_not eq(true)
      expect(json_endpoint.last_result.retry_in).to be_positive
    end
  end
end
