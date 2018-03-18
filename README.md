# consul-templaterb [![Build Status](https://api.travis-ci.org/criteo/consul-templaterb.svg?branch=master)](https://travis-ci.org/criteo/consul-templaterb)

The ruby GEM [consul-templaterb](https://rubygems.org/gems/consul-templaterb)
is both a library and an executable that allows to generate files
using data from Consul (Discovery and Key/Value Store) easily using ruby's
erb templates. It also support launching programs and baby-sitting processes
when rendering the files, thus notifying programs when data do change.

It is intended for user accustomed to expressiveness or Ruby templating (ERB),
allowing for more flexibility and features than Go templates.

It also allows to use all of ruby language, especially useful for generating
files in several formats ([JSON](samples/consul_template.json.erb),
[XML](samples/consul_template.xml.erb)) where text substitutions are hard to get
right.

It also focuses on good performance and lightweight usage of bandwidth,
especially for very large clusters and watching lots of services.

For complicated rendering of templates and large Consul Clusters, it usually
renders faster with a more predictable way the template than the original
consul-template.

## Differences with HashiCorp's consul-template

[Hashicorp's Consul Template](https://github.com/hashicorp/consul-template)
inspired strongly the creation of this GEM and this executable wants
to achieve better results in some use cases, especially for very large
Consul clusters with many nodes and servers.

consul-template has more features regarding Consul support (for instance, it
has support for Hashicorp's Vault), but consul-templaterb focuses on getting
more power with the generation of templates and more performance.

Consul Template uses Go templates which is very limited in its set of
features: it is complicated to sort, apply real transformations
using code and even interact with the OS (ex: get the current date, format
timestamps...).

The sort feature for instances allow you to create predictable output (i.e: meaning
that the order of nodes is predictable), thus it might offer better performance
since the reload of processes if happening ONLY when the files are binary
different. Thus, if using consul-templaterb, you will reload less your haproxy or
load-balancer than you would do with consul-template.

Compared to consul-template, consul-templaterb offers the following features:

* Hot-Reload of template files
* Bandwidth limitation per endpoint (will soon support dynamic bandwidth limiter)
* Supports baby sitting of multiple processes
* Supports all Ruby features (ex: base64, real JSON/XML generation...)
* Information about bandwidth

The executable supports close semantics to Consul template, it also supports
commands when files are modified and supervision of multiple processes with
ability to send signals to those processes when the files do change.

## Installation

You might either use the executable directly OR use this GEM as a library by
adding this line to your application's `Gemfile`:

```ruby
gem 'consul-templaterb'
```

And then execute:

```shell
$ bundle
[...]
```

Or install it yourself as:

```shell
$ gem install consul-templaterb
[...]
```

If you simply want to use the executable on your favorite linux distribution, you
have to install first: ruby and ruby dev.

### Quick install on Ubuntu-Linux

```shell
sudo apt-get install ruby ruby-dev && sudo gem install consul-templaterb
```

You can now use it directly using the binary `consul-templaterb` in your path.

### Playing with the samples templates

Samples are installed with the GEM, you can either
[download](https://github.com/criteo/consul-templaterb/tree/master/samples) them or
simply use the ones installed with the gem. To figure out where the templates are
installed:

```shell
$ gem contents consul-templaterb|grep samples
```

Will output the path where the samples are being installed, you can copy the directory
somewhere and then issue the command:

```shell
$ consul-templaterb samples/*.html.erb
```

It will render a full web site you may browse to look in real time the status of your
Consul Cluster.

## Usage of consul-templaterb

### Show help

```shell
$ consul-templaterb --help
USAGE: bin/consul-templaterb [[options]]
    -h, --help                       Show help
    -v, --version                    Show Version
    -c, --consul-addr=<address>      Address of Consul, eg: http://localhost:8500
        --consul-token=<token>       Use a token to connect to Consul
    -w, --wait=<min_duration>        Wait at least n seconds before each template generation
    -r, --retry-delay=<min_duration> Min Retry delay on Error/Missing Consul Index
    -k, --hot-reload=<behavior>      Control hot reload behaviour, one of :[die (kill daemon on hot reload failure), keep (on error, keep running), disable (hot reload disabled)]
    -K, --sig-term=kill_signal       Signal to sent to next --exec command on kill, default=#{cur_sig_term}
    -R, --sig-reload=reload_signal   Signal to sent to next --exec command on reload (NONE supported), default=#{cur_sig_reload}
    -e, --exec=<command>             Execute the following command
    -d, --debug-network-usage        Debug the network usage
    -t erb_file:[output]:[command],  Add a erb template, its output and optional reload command
        --template
        --once                       Do not run the process as a daemon
```

When launched with file arguments ending with .erb, the executable will assume
the file is a template and will render the corresponding file without the
`.erb` extension.

It means that you can call consul-templaterb with *.erb arguments, the shell
will then substitute all files and render it by removing the .erb extension as
if the `--template my_file.ext.erb:myfile.ext` was used.

### Generate multiple templates

In the same way as consul-template, consul-templaterb supports multiple templates and executing
commands when the files do change. The parameter `--template <ERB>:<DEST>:[reload_command]` works
in the following way:

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

With the `--exec` argument (can be specified multiple times), consul-templaterb will launch
the process specified when all templates have been generated and will send a reload signal
if the content of any of the files do change (the signal will be sent atomically however,
meaning that if 2 results of templates are modified at the same time, the signal will be
sent only once (it is helpful for instance if your app is using several configurations
files that must be consistent all together).

Signals can be customized per process. Two signals are supported with options `--sig-reload` and
`--sig-term`. When the option is added, the next `--exec` options to start a process will use the
given signal. By default, HUP will be sent to reload events (you can use NONE to avoid sending any
reload signal), TERM will be used when leaving consul-templaterb.

### Bandwidth limitation

This is actually the original reason for the creation of this GEM: on Criteo's large clusters,
consul-template generated several hundreds of Mb/s to the Consul-Agent which also
generated several hundreds of Mb/s with the Consul servers.

By design, the GEM supports limiting the number of requests per endpoints (see code in
`bin/consul-templaterb` file). It avoids using too much network to fetch data from Consul
in large Consul Clusters (especially when watching lots of files).

The limitation is static for now, but fair dynamic bandwidth allocation will allow to limit
the bandwidth used to get information for all services by capping the global bandwidth used
by consul-templaterb.

### Samples

Have a look into the [samples/](samples/) directory to browse example files which contains those
examples:

1. [List all nodes on Cluster](samples/nodes.html.erb)
2. [Show all services in Cluster](samples/services.html.erb)
3. [Show all Service Checks and their output](samples/checks.html.erb)
4. [Show all Key/Values nicely](samples/keys.html.erb)
5. [Show Choregraphies  - work on content of K/V with JSON](samples/criteo_choregraphies.html.erb)
6. [Services in XML](samples/consul_template.xml.erb)
7. [Services in JSON](samples/consul_template.json.erb)
8. [Generate HaProxy Configuration](samples/ha_proxy.cfg.erb)

If you want to test it quickly, you might try with (assuming you consul agent is listening on
`http://localhost:8500`):

```
$ be bin/consul-templaterb -c 'http://localhost:8500' samples/*.html.erb
```

It will generate a full website in samples/ directory with lots of Consul information ready to
use (website updated automagically when values to change).

## Template development

Here are the various functions you might use in your templates.

For each function, mandatory arguments are specified at the beginning while optional ones are marked with `[]`.
Most of them support the optional dc attribute to access data from another datacenter. If the `dc`
attribute is not specified, the function will output data from the current datacenter.

To ease template development, `consul-templaterb` supports HOT reload of templates, thus it is possible to
develop the templates interactively. While developing, it is possible to use the switch `--hot-reload=keep`,
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
getting the values. See the file in samples [keys.html.erb](samples/keys.html.erb) for a working example.

### agent_metrics()

[Get the metrics of Consul Agent](https://www.consul.io/api/agent.html#view-metrics). Since this endpoint does
not support blocking queries, data will be refreshed every few seconds, but will not use blocking queries
mechanism.

### agent_self()

[Get the configuration of Consul Agent](https://www.consul.io/api/agent.html#read-configuration).
Since this endpoint does not support blocking queries, data will be refreshed every few seconds,
but will not use blocking queries mechanism.

### render_file(relative_path_to_erb_file, [params={}])

This allow to include a template file into another one. Beware, it does not check for infinite recursion!
The template can be either a static file either another template. The file has to be a valid template, but
can also be raw text (if it is a valid template) and is resolved with a relative path regarding the file
including it.

Example:

```erb
<%= render_file('common/header.html.erb', title: 'My Title') %>
```

Will render header.html.erb with parameter title = 'My Title'. `title` can then be accessed within
the template using `param('title', 'My default Value')` in the `header.html.erb` file.

### param(parameter_name, [default_value: nil])

Can be used within a template to access a parameter. Parameters can be specified with `render_file`
directive. Optional value `default_value` allow to get a value if parameter has not been set.

See [samples/common/header.html.erb](samples/common/header.html.erb) for example of usage.

## Development

We recommend using bundle using `bundle install`, you can now run `bundle exec bin/consul-templaterb`.

To install this gem onto your local machine, run `bundle exec rake install`. To release a new version, update the
version number in `version.rb`, and then run `bundle exec rake release`, which will create a git tag for the version,
push git commits and tags, and push the `.gem` file to [rubygems.org](https://rubygems.org/gems/consul-templaterb).

## Known bugs

Here are the known bugs of the application:

* [ ] On Mac OS X, with many services, consul-templaterb sometimes crashes when watching lots of changes (more than 2k
  watches) at the same time. This bug is
  [probably a race condition in `em-http-request`](https://github.com/igrigorik/em-http-request/issues/315). Only visible
  on very large clusters or when watching thousands of individual KV keys.
* [ ] render_file might create an infinite recursion if a template includes itself indirectly.

Please consult [CHANGELOG.md](CHANGELOG.md) for fixed bugs.

## TODO

* [ ] Hashi's Vault support
* [ ] Implement automatic dynamic rate limit
* [ ] More samples: apache, nginx, full website displaying consul information...
* [ ] Optimize rendering speed at startup: an iteration is done very second by default, but it would be possible to speed
      up rendering by iterating with higher frequency until the first write of result has been performed.
* [ ] Allow to tune bandwidth using a simple config file (while it should not be necessary for 90% of use-cases)

## Contributing

Bug reports and pull requests are welcome on GitHub at https://github.com/criteo/consul-templaterb.
This project is intended to be a safe, welcoming space for collaboration, and contributors are expected to adhere to the
[Contributor Covenant](http://contributor-covenant.org) code of conduct.

## License

The gem is available as open source under the terms of the Apache v2 license. See [LICENSE.txt](LICENSE.txt) file.
