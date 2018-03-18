# Template API for writing templates

Here are the various functions you might use in your templates.

For each function, documentation specifies mandatory arguments at the beginning while optional ones are
annoted with `[]`.
Most of them support the optional dc attribute to use data from another datacenter. If the `dc`
attribute is not specified, the function will output data from the current datacenter.

To ease template development, `consul-templaterb` supports HOT reload of templates, thus it is possible to
develop the templates interactively. While developing, it is possible to use the switch `--hot-reload=keep`,
thus the application will display a warning if the template is invalid and won't stop
(`--hot-reload=die` is the default, thus if the hot-reloaded template has issue, the application will die).

Have a look to [samples/](samples/) directory to start writing your own templates.

## datacenters()

[Get the list of datacenters as string array](https://www.consul.io/api/catalog.html#list-datacenters).

## services([dc: datacenter], [tag: tagToFilterWith])

[List the services matching the optional tag filter](https://www.consul.io/api/catalog.html#list-services),
if tag is not specified, will match all the services. Note that this endpoint performs client side tag
filtering for services to ease templates development since this feature is not available on Consul's endpoint.

## service(serviceName, [dc: datacenter], [tag: tagToFilterWith], [passing: true])

[List the instances](https://www.consul.io/api/health.html#list-nodes-for-service) of a service having the given
optional tag. If no tag is specified, will return all instances of service. By default, it will return all the
well services that are passing or not. An optional argument passing might be used to retrieve only passing instances.

## nodes([dc: datacenter])

[List all the nodes of selected datacenter](https://www.consul.io/api/catalog.html#list-nodes). No filtering is
applied.

## node(nodeNameOrId, [dc: datacenter])

[List all the services of a given Node](https://www.consul.io/api/catalog.html#list-services-for-node) using its
name or its ID. If DC is specified, will lookup for given node in another datacenter.

## checks_for_service(name, dc: nil, passing: false, tag: nil)

[Find all the checks](https://www.consul.io/api/health.html#list-checks-for-service) of a given service.

## kv(name = nil, dc: nil, keys: nil, recurse: false)

[Read keys from KV Store](https://www.consul.io/api/kv.html#read-key). It can be used for both listing the keys and
getting the values. See the file in samples [keys.html.erb](samples/keys.html.erb) for a working example.

## agent_metrics()

[Get the metrics of Consul Agent](https://www.consul.io/api/agent.html#view-metrics). Since this endpoint does
not support blocking queries, data will be refreshed every few seconds, but will not use blocking queries
mechanism.

## agent_self()

[Get the configuration of Consul Agent](https://www.consul.io/api/agent.html#read-configuration).
Since this endpoint does not support blocking queries, data will be refreshed every few seconds,
but will not use blocking queries mechanism.

## render_file(relative_path_to_erb_file, [params={}])

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

## param(parameter_name, [default_value: nil])

Can be used within a template to access a parameter. Parameters can be specified with `render_file`
directive. Optional value `default_value` allow to get a value if parameter has not been set.

It allows to create re-usable sub-templates that might be used in several places with several types
of parameters. Thus, templates can be called like kind of functions and generate output based on
the parameters provided.

Example:

```erb
render_file('show_service.html.erb', {service_name: 'service1',  title: 'My Nice Service'})
[...]
render_file('show_service.html.erb', {service_name: 'service2',  title: 'My Nicer Service'})
```

Note that you can also add parameters into a top level service using the command line:

```sh
consul-templaterb --template "source.html.erb:dest.html:reload_command:params.yaml"
[...]
```

In that case, it would load the content of params.yaml and inject it as params when evaluating
template `source.html.erb`. Injection of params using 4th parameter of `--template` supports
YAML as well as JSON format. Those parameter files are NOT automatically reloaded however.

See [samples/common/header.html.erb](samples/common/header.html.erb) for example of usage.
