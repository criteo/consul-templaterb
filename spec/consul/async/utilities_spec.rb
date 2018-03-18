require 'spec_helper'
require 'consul/async/consul_endpoint'

RSpec.describe Consul::Async::Utilities do
  it 'Correctly formats bytes into human readable format' do
    expect(Consul::Async::Utilities.bytes_to_h(666)).to eq '666 b'
    expect(Consul::Async::Utilities.bytes_to_h(1024)).to eq '1.0 Kb'
    expect(Consul::Async::Utilities.bytes_to_h(1024 * 1024)).to eq '1.0 Mb'
    expect(Consul::Async::Utilities.bytes_to_h(1024 * 1024 * 1024)).to eq '1.0 Gb'
    expect(Consul::Async::Utilities.bytes_to_h(5.5 * 1024 * 1024 * 1024)).to eq '5.5 Gb'
  end

  it 'loads well YAML files' do
    f = Tempfile.new(['parameters', '.yaml'])
    begin
      f.write("password: my secret\nq: none")
      f.close
      expect(Consul::Async::Utilities.load_parameters_from_file(f.path)).to include('password' => 'my secret', 'q' => 'none')
    ensure
      f.unlink
    end
  end

  it 'loads well JSON files' do
    f = Tempfile.new(['parameters', '.json'])
    begin
      f.write('{ "password": "my secret", "q": "none"}')
      f.close
      expect(Consul::Async::Utilities.load_parameters_from_file(f.path)).to include('password' => 'my secret', 'q' => 'none')
    ensure
      f.unlink
    end
  end
end
