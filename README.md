# Consul::Templaterb

This GEM is both a library and an executable that allows to generate files
using ruby's erb templates.

## Why?

The program consul template already supports this kind of behaviour and this
GEM is directly inspired from it.

But Consul Template uses Go templates which is very limited in its set of
features is quite limited: it is complicated to sort, apply real transformations
using code and even interact with the OS (ex: get the current date, format
timestamps...).

Compared to consul-template, consul-templaterb offers the following features:

* Hot-Reload of template files
* Bandwith limitation per endpoint (will soon support dynamic bandwith limiter)
* Supports baby sitting of multiple processes
* Supports all Ruby features (ex: base64, real XML generation...)
* Information about bandwidth

The executable supports close semantics to Consul template, it also supports
commands when files are modified and babysitting of multiple processes with
ability to send signals to those processes whenever the files do change.

## Installation

You might either use the executable direcly OR use this GEM as a library by
adding this line to your application's Gemfile:

```ruby
gem 'consul-templaterb'
```

And then execute:

    $ bundle

Or install it yourself as:

    $ gem install consul-templaterb

## Usage of consul-templaterb

### Show help

```shell
$ consul-templaterb --help
```

### Generate multiple templates

In the same way as consul-template, consul-templaterb supports multiple templates and executing
commands when the files do change. The parameter --template <ERB>:<DEST>:[reload_command] :
* ERB : the ERB file to use as a template
* DEST: the destination file
* reload_command: optional shell command executed whenever the file has been modified

The argument can be specified multiple times, ex:

Example of usage:
```shell
$ consul-templaterb \\
  --template "samples/ha_proxy.cfg.erb:/opt/haproxy/etc/haproxy.cfg:sudo service haproxy reload"
  --template "samples/consul_template.erb:consul-summary.txt"
```

### Process management and signalisation of configuration files

With the --exec argument (can be specified multiple times), consul-templaterb will launch
the process specified when all templates have been generated and will send a HUP signal
if the content of any of the files do change (the signal will be sent atomically however,
meaning that if 2 results of templates are modified at the same time, the signal will be
sent only once (it is helpful for instance if your app is using several configurations
files that must be consistent all together).

### Bandwidth limitation

By design, the GEM supports limiting the number of requests per endpoints (see code in
`bin/consul-templaterb` file). It avoids using too much network to fetch data from Consul
in large Consul Clusters (especially when watching lots of files).

The limitation is currently static, but fair dynamic bandwidth allocation will allow to limit
the bandwidth used to get information for all services by capping the global bandwidth used
by consul-templaterb.

### Samples

Have a look into the samples/ directory to browse example files.

## Development

After checking out the repo, run `bin/setup` to install dependencies. Then, run `rake spec` to run the tests. You can also run `bin/consul-templaterb` for an interactive prompt that will allow you to experiment.

To install this gem onto your local machine, run `bundle exec rake install`. To release a new version, update the version number in `version.rb`, and then run `bundle exec rake release`, which will create a git tag for the version, push git commits and tags, and push the `.gem` file to [rubygems.org](https://rubygems.org).

## Contributing

Bug reports and pull requests are welcome on GitHub at https://github.com/[USERNAME]/consul-templaterb. This project is intended to be a safe, welcoming space for collaboration, and contributors are expected to adhere to the [Contributor Covenant](http://contributor-covenant.org) code of conduct.


## License

The gem is available as open source under the terms of the [MIT License](http://opensource.org/licenses/MIT).

