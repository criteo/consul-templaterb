# coding: utf-8
lib = File.expand_path('../lib', __FILE__)
$LOAD_PATH.unshift(lib) unless $LOAD_PATH.include?(lib)
require 'consul/async/version'

Gem::Specification.new do |spec|
  spec.name          = 'consul-templaterb'

  version            = Consul::Async::VERSION
  patch_version      = case `git describe --tags`.to_s
                       when /^#{version}.(\d+)-/
                         Regexp.last_match(1).to_i + 1
                       when /^#{version}.(\d+)/
                         Regexp.last_match(1).to_i
                       else
                         0
                       end

  spec.version       = "#{version}.#{patch_version}"
  spec.authors       = ['SRE Core Services']
  spec.email         = ['sre-core-services@criteo.com']

  spec.summary       = 'Implementation of Consul template using Ruby and .erb templating language'
  spec.homepage      = 'http://review.criteois.lan/#/admin/projects/ruby-gems/consul-templaterb'
  spec.description   = 'A ruby implementation of Consul Template with support of erb templating'

  spec.license       = 'MIT'

  # Prevent pushing this gem to RubyGems.org. To allow pushes either set the 'allowed_push_host'
  # to allow pushing to a single host or delete this section to allow pushing to any host.
  if spec.respond_to?(:metadata)
    spec.metadata['allowed_push_host'] = "TODO: Set to 'http://mygemserver.com'"
  else
    raise 'RubyGems 2.0 or newer is required to protect against ' \
      'public gem pushes.'
  end

  spec.files = `git ls-files -z`.split("\x0").reject do |f|
    f.match(%r{^(test|spec|features)/})
  end
  spec.bindir        = 'exe'
  spec.executables   = spec.files.grep(%r{^exe/}) { |f| File.basename(f) }
  spec.require_paths = ['lib']

  spec.require_paths = ['lib']
  spec.add_runtime_dependency 'em-http-request', '>= 1.1.5'

  spec.add_development_dependency 'bundler', '>= 1.14'
  spec.add_development_dependency 'rake', '~> 10.0'
  spec.add_development_dependency 'rspec', '~> 3.0'
  spec.add_development_dependency 'rspec_junit_formatter'
  spec.add_development_dependency 'rubocop', '0.42.0'
  spec.add_development_dependency 'rubocop-junit-formatter'
  spec.add_development_dependency 'nexus'
  spec.add_development_dependency 'webmock'
end
