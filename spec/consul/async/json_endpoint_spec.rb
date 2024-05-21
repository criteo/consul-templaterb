# frozen_string_literal: true

require 'rspec'
require 'spec_helper'
require 'consul/async/json_endpoint'
require 'webmock/rspec'

RSpec.describe Consul::Async do
  context 'default parameters' do
    it 'response 200' do
      mock_url = 'http://working.url'
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

    it 'response 500' do
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

  context 'when default_value_on_error on' do
    let(:default_value_on_error) { true }
    context 'when response 500' do
      it 'return default value' do
        mock_url = 'http://not.working.url'
        conf = Consul::Async::JSONConfiguration.new(url: mock_url, min_duration: 10, retry_on_non_diff: 20)
        default_value = '["default", "value"]'

        json_endpoint = nil
        stub_request(:get, mock_url)
          .to_return(body: '', status: 500)
        EM.run_block do
          json_endpoint = Consul::Async::JSONEndpoint.new(conf, mock_url, default_value, default_value_on_error: default_value_on_error)
        end
        EM.run_block do
          expect(json_endpoint.ready?).to eq(true)
          expect(json_endpoint.last_result.data).to eq(default_value.to_json)
          expect(json_endpoint.last_result.retry_in).to be_positive
        end
      end
    end

    context 'when address is not reachable' do
      it 'return default value' do
        mock_url = 'http://not.working.url'
        conf = Consul::Async::JSONConfiguration.new(url: mock_url, min_duration: 10, retry_on_non_diff: 20)
        default_value = '["default", "value"]'

        json_endpoint = nil
        stub_request(:get, mock_url).to_timeout
        EM.run_block do
          json_endpoint = Consul::Async::JSONEndpoint.new(conf, mock_url, default_value, default_value_on_error: default_value_on_error)
        end
        EM.run_block do
          expect(json_endpoint.ready?).to eq(true)
          expect(json_endpoint.last_result.data).to eq(default_value.to_json)
          expect(json_endpoint.last_result.retry_in).to be_positive
        end
      end
    end

    context 'when response 200' do
      it 'return value from endpoint' do
        mock_url = 'http://working.url'
        conf = Consul::Async::JSONConfiguration.new(url: mock_url, min_duration: 10, retry_on_non_diff: 20)
        default_value = '["default", "value"]'
        endpoint_body = '{"a": "b"}'

        json_endpoint = nil
        stub_request(:get, mock_url)
          .to_return(body: endpoint_body, status: 200)

        EM.run_block do
          json_endpoint = Consul::Async::JSONEndpoint.new(conf, mock_url, default_value, default_value_on_error: default_value_on_error)
        end
        EM.run_block do
          expect(json_endpoint.ready?).to eq(true)
          expect(json_endpoint.last_result.data.to_json).to eq(endpoint_body.to_json)
          expect(json_endpoint.last_result.retry_in).to be_positive
        end
      end
    end
  end
end
