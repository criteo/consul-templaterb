lib = File.expand_path('lib', __dir__)
$LOAD_PATH.unshift(lib) unless $LOAD_PATH.include?(lib)
require 'consul/async/version'

Gem::Specification.new do |spec|
  spec.name          = 'consul-templaterb'

  spec.version       = Consul::Async::VERSION
  spec.authors       = ['SRE Core Services']
  spec.email         = ['sre-core-services@criteo.com']

  spec.summary       = 'Implementation of Consul template using Ruby and .erb templating language'
  spec.homepage      = 'https://rubygems.org/gems/consul-templaterb'
  spec.description   = 'A ruby implementation of Consul Template with support of erb templating ' \
                       'with hi-performance on large clusters and advanced process management features.'
  spec.metadata      = { 'bug_tracker_uri' => 'https://github.com/criteo/consul-templaterb/issues',
                         'changelog_uri' => 'https://github.com/criteo/consul-templaterb/blob/master/CHANGELOG.md',
                         'homepage_uri' => 'https://github.com/criteo/consul-templaterb',
                         'source_code_uri' => 'https://github.com/criteo/consul-templaterb' }
  spec.license       = 'Apache v2'

  spec.files = `git ls-files -z`.split("\x0").reject do |f|
    f.match(%r{^(test|spec|features)/})
  end
  spec.bindir        = 'bin'
  spec.executables   = spec.files.grep(%r{^bin/}) { |f| File.basename(f) }
  spec.extra_rdoc_files = ['README.md', 'CHANGELOG.md', 'TemplateAPI.md']
  spec.require_paths = ['lib']
  spec.required_ruby_version = '>= 2.4.0'

  spec.add_runtime_dependency 'em-http-request', '>= 1.1.5'
  spec.add_runtime_dependency 'eventmachine', '>= 1.2.7'
  spec.add_runtime_dependency 'parallel', '>= 1.2.7'

  spec.add_development_dependency 'bundler', '>= 1.14'
  spec.add_development_dependency 'rake', '~> 12.3.3'
  spec.add_development_dependency 'rspec', '~> 3.0'
  spec.add_development_dependency 'rspec_junit_formatter'
  spec.add_development_dependency 'rubocop', '0.80.0'
  spec.add_development_dependency 'rubocop-junit-formatter'
  spec.add_development_dependency 'webmock'
end
