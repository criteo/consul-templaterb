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
the process specified when all templates have been generated and will send a reload signal
if the content of any of the files do change (the signal will be sent atomically however,
meaning that if 2 results of templates are modified at the same time, the signal will be
sent only once (it is helpful for instance if your app is using several configurations
files that must be consistent all together).

Signals can be customized per process. Two signals are supported with options --sig-reload and
--sig-term. When the option is added, the next --exec options to start a process will use the
given signal. By default, HUP will be sent to reload events (you can use NONE to avoid sending any
reload signal), TERM will be used when leaving consul-templaterb.


### Bandwidth limitation

By design, the GEM supports limiting the number of requests per endpoints (see code in
`bin/consul-templaterb` file). It avoids using too much network to fetch data from Consul
in large Consul Clusters (especially when watching lots of files).

The limitation is currently static, but fair dynamic bandwidth allocation will allow to limit
the bandwidth used to get information for all services by capping the global bandwidth used
by consul-templaterb.

### Samples

Have a look into the samples/ directory to browse example files.

## Template development

Here are the various functions you might use in your templates.

For each function, mandatory arguments are specified at the begining while optional ones are marked with `[]`.
Most of them support the optional dc attribute to access data from another datacenter. If the `dc`
attribute is not specified, the function will output data from the current datacenter.

To ease template development, `consul-templaterb` supports HOT reload of templates, thus it is possible to
develop the templates interactivelly. While developping, it is possible to use the switch `--hot-reload=keep`,
thus the application will display a warning if the template is invalid and won't stop
(`--hot-reload=die` is the default, thus if the hot-reloaded template has issue, the application will die).

### datacenters()

[Get the list of datacenters as string array](https://www.consul.io/api/catalog.html#list-datacenters).

### services([dc: datacenter], [tag: tagToFilterWith])

[List the services matching the optional tag filter](https://www.consul.io/api/catalog.html#list-services),
if tag is not specified, will match all the services. Note that this endpoint performs client side tag
filtering for services to ease templates development since this feature is not available on Consul's endpoint.

### service(serviceName, [dc: datacenter], [tag: tagToFilterWith], [passing: true])

[List the instances](https://www.consul.io/api/health.html#list-nodes-for-service) of a service having the given
optional tag. If no tag is specified, will return all instances of service. By default, it will return all the
well services that are passing or not. An optional argument passing might be used to retrieve only passing instances.

### nodes([dc: datacenter])

[List all the nodes of selected datacenter](https://www.consul.io/api/catalog.html#list-nodes). No filtering is
applied.

### node(nodeNameOrId, [dc: datacenter])

[List all the services of a given Node](https://www.consul.io/api/catalog.html#list-services-for-node) using its
name or its ID. If DC is specified, will lookup for given node in another datacenter.

### checks_for_service(name, dc: nil, passing: false, tag: nil)

[Find all the checks](https://www.consul.io/api/health.html#list-checks-for-service) of a given service.

### kv(name = nil, dc: nil, keys: nil, recurse: false)

[Read keys from KV Store](https://www.consul.io/api/kv.html#read-key). It can be used for both listing the keys and
getting the values. See samples/dump_keys.html.erb for a working example.

### agent_metrics()

[Get the metrics of Consul Agent](https://www.consul.io/api/agent.html#view-metrics). Since this endpoint does
not support blocking queries, data will be refreshed every few seconds, but will not use blocking queries
mechanism.

### agent_self()

[Get the configuration of Consul Agent](https://www.consul.io/api/agent.html#read-configuration). Since this
endpoint does not support blocking queries, data will be refreshed every few seconds, but will not use blocking
queries mechanism.

### render_file RELATIVE_PATH_TO_ERB_FILE

This allow to include a template file into another one. Beware, it does not check for infinite recursion!
The template can be either a static file either another template.

Example:

```erb
<%= render_file 'header.html.erb' %>
```

## Development

We recommend using bundle using `bundle install`, you can now run `bundle exec bin/consul-templaterb`.

To install this gem onto your local machine, run `bundle exec rake install`. To release a new version, update the version number in `version.rb`, and then run `bundle exec rake release`, which will create a git tag for the version, push git commits and tags, and push the `.gem` file to [rubygems.org](https://rubygems.org).

## Contributing

Bug reports and pull requests are welcome on GitHub at https://github.com/[USERNAME]/consul-templaterb. This project is intended to be a safe, welcoming space for collaboration, and contributors are expected to adhere to the [Contributor Covenant](http://contributor-covenant.org) code of conduct.


## License

The gem is available as open source under the terms of the [MIT License](http://opensource.org/licenses/MIT).

