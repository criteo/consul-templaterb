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

## Common structure of returned objects

All objects returned by those functions described below all share the same structure:

* `.result` : handle the result
* `.endpoint` : get technical information about how data was retrieved and statistics.

## Accessing to statistics to monitor your cluster

All endpoints implement technical interface that allow to get information about what
is going on in your Consul Cluster.

On each object, you can access the `.endpoint` object that includes several informations about the endpoint being queried:

* `myresult.endpoint.x_consul_index` return the current index on blocking query
* `myresult.endpoint.stats` a object with interresting fields: `bytes_per_sec`,
  `bytes_per_sec_human`, `successes`, `errors`, `body_bytes`, `last_modified`. All stats details
  are available in the file [lib/consul/async/stats.rb](lib/consul/async/stats.rb).

Using those statistics might be useful to trigger alerts very easily when something
is going on. Have a look to [samples/metrics.erb](samples/metrics.erb) that exposes
most of those metrics to [Prometheus](https://prometheus.io/).

## Common re-implemented functions for all objects

Most objects returned by all those functions are contained within a `.result` object. However, in order
to avoid having to write .result in all templates, some shortcuts have been added:

* `[]` allow to either access values for map-based data or arrays
* for all objects: `.each`, `sort`, `.select`, `.each_value`, `.count`, `.empty?`
* additionnaly, for map based results, the following methods are available: `.keys`,  `.values`, `.each_pair`,
  `.each_value`

See [lib/consul/async/consul_template.rb:230](lib/consul/async/consul_template.rb#L230) and
[lib/consul/async/consul_template.rb:260](lib/consul/async/consul_template.rb#L260) for up to date list of
all those methods.

## datacenters()

[Get the list of datacenters as string array](https://www.consul.io/api/catalog.html#list-datacenters).

<details><summary>Examples</summary>
<div class="samples">

### List all datacenters in a text list and count services and nodes within

```erb
<% datacenters.each do |dc| %>
  * <%= dc %> with <%= services(dc:dc).keys.count %> services, <%= nodes(dc:dc).count %> nodes
<% end %>
```

Full example: [samples/consul_template.txt.erb](samples/consul_template.txt.erb)

</div>
</details>

## services([dc: datacenter], [tag: tagToFilterWith])

[List the services matching the optional tag filter](https://www.consul.io/api/catalog.html#list-services),
if tag is not specified, will match all the services. Note that this endpoint performs client side tag
filtering for services to ease templates development since this feature is not available on Consul's endpoint.

<details><summary>Examples</summary>
<div class="samples">

### List all services in default datacenter and display its tags

```erb
<% services.each do |service_name, tags|
 %>  * <%= service_name %> [ <%= tags %> ]
<% end %>
```

Full example: [samples/consul_template.txt.erb](samples/consul_template.txt.erb)

### List all services in all datacenters having tag  `http`

```erb
<%
  datacenters.each do |dc| %>
  * Datacenter <%= dc %>
  <%
    services(dc:dc, tag:'http').each do |service_name, tags|
    %>
    - service <%= service_name %> <%= tags.sort %><%
    end
  end
%>
```

</div>
</details>

## service(serviceName, [dc: datacenter], [tag: tagToFilterWith], [passing: true])

[List the instances](https://www.consul.io/api/health.html#list-nodes-for-service) of a service having the given
optional tag. If no tag is specified, will return all instances of service. By default, it will return all the
services that are passing or not. An optional argument passing might be used to retrieve only passing instances.

### Helpers

#### service_address

This object also contains a Helper to get easily the correct Address by using `service_address` which returns
the optional `['Service']['Address']` if found or `['Node']['Address']` otherwise.

#### status

Computing the status of an instance is non-trivial as it requires to parses all statuses of all checks and take
the worse of all thoses Status object. The `.status` attribute can be used as an alternative as it precomputes
this state in the same way consul does, it will then return the worse of all the statuses of all checks.
Returned value will be one of `passing`|`warning`|`critical`.

#### weights

`.weights` give the ability to deal with new `Weights` feature added in Consul 1.2.3.
It returns a Hash with `{"Passing": weight_when_service_is_passing, "Warning": weight_when_value_is_warning}`
to allow having weighted load balancing when statuses in Consul do change. It also deals nicely with versions
of Consul not yet supporting Weights.

#### current_weight

`.current_weight` computes automagically weight given the current status of service. It works the same way as
the DNS implementation of Consul.

<details><summary>Examples</summary>
<div class="samples">

### List all services instances with http tag on current DC, instances sorted by node name

```erb
<% services.each do |service_name, tags|
     if tags.include? 'http'
%>  ++ Service <%= service_name %>
<%     service(service_name, tag:'http').sort {|a,b| a['Node']['Node'] <=> b['Node']['Node'] }.each do |snode|
%>  * <%= service_name %> -> <%=
  snode['Node']['Node'] %>:<%= snode['Service']['Port'] %>  <%=
  snode['Service']['Tags'] %> status: <%= snode.status %> Current Weight: <%= snode.current_weight %> Checks: <%
  snode['Checks'].each do |c| %> <%= c['Status']
  %><% end if snode['Checks'] %>
<%     end
     end
   end %>
```

Full example: [samples/consul_template.txt.erb](samples/consul_template.txt.erb)

</div>
</details>

## nodes([dc: datacenter])

[List all the nodes of selected datacenter](https://www.consul.io/api/catalog.html#list-nodes). No filtering is
applied.

<details><summary>Examples</summary>
<div class="samples">

### List all nodes for DC, sorted by name

```erb
<% nodes.sort {|a,b| a['Node'] <=> b['Node'] }.each do |snode|
%>  * <%= snode['Address'].ljust(16) %> <%= snode['Node'] %>
<% end %>
```

Full example: [samples/consul_template.txt.erb](samples/consul_template.txt.erb)

</div>
</details>

## node(nodeNameOrId, [dc: datacenter])

[List all the services of a given Node](https://www.consul.io/api/catalog.html#list-services-for-node) using its
name or its ID. If DC is specified, will lookup for given node in another datacenter.

## checks_for_service(name, dc: nil, passing: false, tag: nil)

[Find all the checks](https://www.consul.io/api/health.html#list-checks-for-service) of a given service.

## kv(name, [dc: nil], [keys: false], [recurse: false])

[Read keys from KV Store](https://www.consul.io/api/kv.html#read-key). It can be used for both listing the keys and
getting the values. See the file in samples [keys.html.erb](samples/keys.html.erb) for a working example.

Variants:

* no additional parameter: will only retrieve the key you asked for
* `keys: true` : will retrieve the hierarchy of keys, but without the values, useful if values might be large, in
  order to perform simple listings
* `recurse: true`: will retrieve all hierarchy of keys with their values

Please have a look at [samples/sample_keys.html.erb](samples/sample_keys.html.erb) for examples on how using it.

### Using the result of kv

Since KV has several modes, it depends whether you asked for one or several keys.

Thus, we recommend using a helper to get the value (while you might use it directly).

In order to ease the use, 3 helpers are available and all have a optional argument `path`. When path is specified
and the call is retrieving several keys, it allows to select a specific one.The available helpers are the following:

* `get_value( [path] )` : Get a raw value
* `get_value_decoded( [path] )` : Get the value decoded from Base64
* `get_value_json( [path], [catch_errors: true] )` : when your payload is JSON,
  decode Base64 first and then decode the JSON. If catch_errors is set to true,
  if will not throw an error during rendering of template and return nil. Otherwise
  an Error will be thrown and have to be catch if you are unsure if the value is valid
  JSON
* `get_value_yaml( [path], [catch_errors: true] )` : same as above, but for yml

#### Get the result of a single value

The easiest, use the helpers to retrieve the values in the following formats:

* `kv('/my/path/to/value').get_value` : get the raw value of a single key in KV
* `kv('/my/path/to/value').get_decoded` : get the decoded value of a single key in KV
* `kv('/my/path/to/value').get_value_json` : get the base64 decoded value and try decoding it as JSON

* `kv('/my/path/to/value').get_value_yaml` : get the base64 decoded value and try decoding it as YAML

#### Iterate over values

If you want to iterate amongst all values, you might to it that way:

```erb
<%
kv('/my/multiple/values', recurse: true).each do |tuple|
  key = tuple['Key']
  value_decoded = Base64.decode64(tuple['Value'])
%>
  <div>Decoded value: <%= value_decoded %>
  <div>JSON value: <%= JSON.parse( value_decoded ) %>
<%
end
%>
```

#### Fetch all values at once, but interrested only by a few

When using `kv('/my/multiple/values', recurse: true)`, only a single call is performed, thus,
it is far more efficient to retrive multiple values from the KV under the same root. Thus,
in order to display several discreet values, it is possible to do the following:

```erb
result = kv('/my/multiple/values', recurse: true)
value1 : <%= result.get_decoded('/my/multiple/values/value1') %>
value42 : <%= result.get_decoded('/my/multiple/values/value42') %>
value123 : <%= result.get_decoded('/my/multiple/values/value123') %>
```

Since `kv('/my/multiple/values', recurse: true)` will retrieve all values at once, it might be more
efficient in some cases than retrieving all values one by one.

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

## render_from_string(template_to_render, [params={}])

Similar to render_file but from a string.
Allows to render a template from a string. Useful if you have your templates in KV for instance.

Example:

Given the value in Consul's KV `my/template/to_render`: `from KV: <%= 5 * 2 %>`

```erb
<%= render_from_string(kv('my/template/to_render').get_value_decoded) %>
```

Would render the value: `from KV: 10`.

That's very usefull if you want to centralize your templates and being able to change the value
with a simple PUT call in the KV.

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

See [samples/common/header.html.erb](samples/common/header.html.erb) for example of usage.

## secrets(prefix)

It requires that a Vault token is given either in parameter or in environment variable
The [policies](https://www.vaultproject.io/docs/concepts/policies.html) should be properly set.

List the secrets in vault under a given prefix.

<details><summary>Examples</summary>
<div class="samples">

### List all LDAP entities configured in Vault

```erb
<% ['users','groups'].each do |entity_type|
%><%= entity_type.capitalize %>: <%
    secrets("auth/ldap/#{entity_type}/").each do |entity|
%> * <%=entity%>
<% end %>
<% end %>
```

Full example: [samples/vault-ldap.txt.erb](samples/vault-ldap.txt.erb)

</div>
</details>

## secret(path, [data = nil])

It requires that a Vault token is given either in parameter or in environment variable
The [policies](https://www.vaultproject.io/docs/concepts/policies.html) should be properly set.

Either read or write on a path in vault.

Having a non-nil data Hash will change the behavior from read to update and apply the given data.

Notice: For the moment the versionned KV abstration is not handled, if you want to access versioned KV, you have to hit the logical paths directly.

<details><summary>Examples</summary>
<div class="samples">

### Read LDAP configuration

```erb
secret('auth/ldap/config')['data']
```

Full example: [samples/vault-ldap.txt.erb](samples/vault-ldap.txt.erb)


### Read a path in non-versionned KV
```erb
secret('secret/foo', [force_ttl: intInSecond])
```

</div>
</details>

## template_info()

It returns information about current template being rendered.
The information returned has the following structure:

- `destination`: absolute path where the file is gonna be written
- `source`: the template absolute path file, most of the time, if will be
  equal to `source_root`, except when the current template is included
  in another template using `render_file()`
- `source_root`: the root template absolute file.
- `was_rendered_once` true if whole template structure has been rendered
  at least once, false if current template data is still incomplete.

<details><summary>Examples</summary>
<div class="samples">

### Display template info

```erb
I am the file <%= File.basename(template_info['source']) %><%
  if template_info['source'] != template_info['source_root']
%> included from template <%= File.basename(template_info['source_root']) %><%
  end
%> rendered as <%= File.basename(template_info['destination']) %>
```

#### Simple rendering

The command `consul-template template_info.erb` would render:

```
I am the file template_info.erb rendered as template_info`
```

#### Rendering with template included into another

If creating a file called include.erb with contents: `<%= render_file('template_info.erb') %>`,
the command `consul-templaterb --template include.erb:destination_file.txt` would render:

```
I am the file template_info.erb included from template include.erb rendered as destination_file.txt`
```

</div>
</details>
