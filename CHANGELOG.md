# CHANGELOG

## (UNRELEASED)

## 1.17.2 (July 17, 2019)

IMPROVEMENTS:

 * if template uses fork, do not kill child processes launched by exec

## 1.17.1 (July 15, 2019)

NEW FEATURES:

 * consul-ui now supports displaying coordinates and evaluating RTT for any node

## 1.17.0 (July 15, 2019)

IMPROVEMENTS:

 * when failing to write a file, describe the error with more context (file size...)

NEW FEATURES:

Added new coordinates endpoints:
 * `coordinate.datacenters` list coordinates of datacenters (WAN)
 * `coodinate.nodes` list coordinates of nodes (LAN)

## 1.16.0 (July 8, 2019)

Added new helpers for `service()`

 * `node_meta` return `['Node']['Meta'] or empty hash
 * `service_meta` return `['Service']['Meta'] or empty hash for old consul versions
 * `service_or_node_meta_value(key)` return a the value associated with key in meta from
   service if in service, from node if in node, or nil if meta found nowhere.

## 1.15.3 (June 20, 2019)

Improved consul-ui Javascript #37 thanks to [@warrenseine](https://github.com/warrenseine)

## 1.15.2 (June 12, 2019)

IMPROVEMENTS

`samples/metrics.erb` can now output metrics with labels for services with any kind of
service/node meta. You can tune output of prometheus labels with the environment
variable `PROMETHEUS_EXPORTED_SERVICE_META` which contains the keys separated by
commas to extract from Service.Meta or Node.Meta.

Using `PROMETHEUS_EXPORTED_SERVICE_META='version,os'` would add prometheus labels
version="xx",os="linux" on instances having those metadata on service or nodes when
meta is available.

## 1.15.1 (May 23, 2019)

IMPROVEMENTS

Will converge faster if some templates are not always requesting the same paths.
Intead of relying on key being garbage collected, we now rely whether the key is
available within the current rendering only.
It avoid templates never rendering fully when keys appear/disappear.

## 1.15.0 (May 14, 2019)

NEW FEATURES

consul-templaterb now returns an error code whether template is malformed.
This allows to use return code to validate templates when called with `--once`.

IMPROVEMENTS

Do not display ugly stack trace when interrupting program with CRTL-C.

## 1.14.1 (May 13, 2019)

NEW FEATURES

`endpoint.stats.last_modified` allow to display the date at which the data was last modified.

## 1.14.0 (May 6, 2019)

NEW FEATURES:

When `return nil` is performed in a template, consul-templaterb now considers the template is
not ready and thus do not start any process. It is useful if you want to start a process ONLY
when some conditions are met.

## 1.13.1 (April 12, 2019)

IMPROVEMENTS:

 * Added support for loading KV with YAML using `get_value_yaml()`

## 1.13.0 (April 10, 2019)

IMPROVEMENTS:

 * On Windows, ensure a proper error message is displayed when watching more than 2048 endpoints
 * consul-ui now allow better searches in instances, display node meta in service details, fixed display of tags on Ffx

## 1.12.0 (April 4, 2019)

NEW FEATURES:

* Windows compatible

consul-templaterb now works on Windows.

## 1.11.0 (March 16, 2019)

NEW FEATURES:

* Added new function render_from_string() to render a template from a string (useful with KV)

## 1.10.1 (February 28, 2019)

BUGFIX:

 * Ensure that timeline sort properly events when healthchecks are removed (eg: maintenance)

## 1.10.0 (February 27, 2019)

IMPROVEMENTS:

 * new sample [samples/tools/find_all_failing_services.txt.erb](samples/tools/find_all_failing_services.txt.erb)
   to find all failing service instances on all DCs very easily.
 * Do not report timestamps in metrics.erb as it is toxic for Prometheus
 * in metrics.erb, add all net_info statistics to observe consul-templaterb itself
 * new flag -l <error|info|debug> to control verbosity of messages
 * Now diplays Checks of a Node in Consul-UI

## 1.9.9 (January 18, 2019)

IMPROVEMENTS:

 * `EXCLUDE_SERVICES` now supports regexps to blacklist many services easily

## 1.9.8 (January 16, 2019)

BUGFIX:

 * When default value was the same as real value, endpoints were always marked as
   dirty, thus rendering of templates did never succeed.
   Since default value for service was '[]', trying to fetch a non-existing service
   did forbid templates to converge.

## 1.9.7 (January 15, 2019)

IMPROVEMENTS:

 * `timeline.json.erb` now uses `CONSUL_TIMELINE_BLACKLIST` environment variable
   to blacklist services to be hidden from timeline.

## 1.9.6 (January 15, 2019)

BUGFIX:

 * Keep connections open properly as it increase timeouts on Consul servers on
   very large templates

IMPROVEMENTS:

 * Display error message when Retrying every 10 errors

## 1.9.5 (January 14, 2019)

BUGFIX:

 * Ensure to always re-open Connection to Consul agent in case of network error

## 1.9.4 (January 11, 2019)

OPTIMIZATIONS:

 * inactivity_timeout now includes Consul Jitter for services not changing much
   (less than every 10 minutes)

IMPROVEMENTS:

 * Minor UX improvements in consul-timeline

## 1.9.3 (January 9, 2019)

IMPROVEMENTS:

 * Perform some randomization on retries, so in case of massive errors,
   system will likely re-open all connections at the same time.
 * consul-timeline more optimize ringbuffer for larger history
 * UI improvements (tooltips for services/checks)

## 1.9.2 (January 4, 2019)

IMPROVEMENTS:

 * Nicer display of messages at startup
 * Minor consul-timeline improvements

NEW FEATURES:

 * -M flag to debug memory for templates having leaks

## 1.9.1 (January 3, 2019)

NEW FEATURES:
 
 * Now display effective network bandwidth instead of uncompressed bandwidth
 * for catalog/services and catalog/nodes, now min delay is 15s instead of 30s

IMPROVEMENTS:

 * Removed Ruby 2.3 from Travis, build with Ruby 2.6 in Travis

## 1.9.0 (January 2, 2019)

OPTIMIZATIONS:

 * Better network issue because of X-Consul-Index parsing bug

NEW FEATURES:

 * value.endpoint.x_consul_index now works as expected

IMPROVEMENTS:

 * timeline now works well behing load balancer without stickyness
 * Now hide service column when filtering on a service
 * apply row limits immediately
 * auto-refresh duration is now configurable by `TIMELINE_REFRESH_MS`
   environment variable

## 1.8.6 / 1.8.7 / 1.8.8 (December 20, 2018)

OPTIMIZATIONS:

 * Full rewrite of filtering of consul-timeline to allow handling
   history of 100k+ records 
 * Various UI improvements

## 1.8.5 (December 18, 2018)

OPTIMIZATIONS:

 * Use less memory on the client side for consul-timeline
 * Properly handle multiple instances of JSON file behinf a LB

## 1.8.3 / 1.8.4 (December 18, 2018)

OPTIMIZATIONS:

 * Consul timeline now autorefresh itself
 * large performance improvement in Consul

## 1.8.2 (December 18, 2018)

NEW FEATURES:

 * Added Consul timeline that displays all the changes on services in Consul UI.

## 1.8.1 (December 12, 2018)

BUGFIX:

 * Properly fill `template_info` strtucture when hot reload is performed so templates using
   `template_info()` new function can behave nicely.

NEW FEATURES:

 * template_info now includes `hot_reloading_in_progress: true` when the hotreloading is in progress.

## 1.8.0 (December 11, 2018)

NEW FEATURES:

 * Added new function `template_info` to get information about the file being rendered and whether
   the first rendering phase is completed.

## 1.7.0 (December 7, 2018)

OPTIMIZATIONS:

 * Improved startup time (especially useful with `--once` option)
 * Now iterate as fast as possible until scheduled rendering has started, so rendering is way faster

BUG FIXES:

 * --wait was not working as expected, no properly set the minimum time between templates generation

## 1.6.3 (December 4, 2018)

BUG FIXES:

 * consul-ui: Filtering per tag / service name was broken by commit 410a5407dbff10ae565c214674d986cd84ffed53

## 1.6.2 (December 4, 2018)

BUG FIXES:

 * Fixed bug in samples/metrics.erb

## 1.6.1 (December 4, 2018)

BUG FIXES:

 * In consul-ui, display the port only when port is set

## 1.6.0 (November 23, 2018)

BUG FIXES:

 * Fixed rendering of favorites on Firefox in consul-ui

NEW FEATURES:

 * Added the following helpers to help dealing with new Consul features and simplify writting templates in results
   of `service()` calls:
     * `status` to compute aggregated status of a service taking into account all checks
     * `weights` to deal with weights added in Consul 1.2.3
     * `current_weight` to deal with weight computed using the current status
 * Added new option `-g` for disabling GZIP compression

## 1.5.9 (November 17, 2018)

BUG FIXES:

 * Upgraded potentially vulnerable bootstrap library

IMPROVEMENTS:

 * Clearer help (indentation issue), added `-o` option as synonym for `--once`

## 1.5.8 (November 14, 2018)

IMPROVEMENTS:

 * Add consul_service_changes_total metric in samples/metrics.erb

BUG FIXES:

 * Remove metrics timestamping in samples/metrics.erb to allow datapoint collection when there are no changes on a service

## 1.5.7 (November 12, 2018)

NEW FEATURES:

 * Services can be favorited in samples/consul-ui. Favorited services are kept on top of the list for easier finding.

## 1.5.6 (September 30, 2018)

IMPROVEMENTS:

 * Added methods to get timestamps on each endpoint
 * Use timestamps in [Prometheus template](samples/metrics.erb) to get more precise metrics

## 1.5.5 (September 27, 2018)

IMPROVEMENTS:

 * Improved [Prometheus template](samples/metrics.erb) with many new metrics
 * Documentation improvements regarding statistics and endpoints
 * Code cleanups, code style, remove unused source file
 * Travis build now runs rubocop and test with Ruby version from 2.3.x to 2.5.x

## 1.5.4 (September 26, 2018)

IMPROVEMENTS:

 * [Prometheus template](samples/metrics.erb) to export easily Consul
   informations about nodes, datacenters and all services states
 * Code style cleanup + travis now enforces Rubocop
 * Remove criteo references in spec files thanks to @pierrecdn
 * Bitrate display more consistent thanks to @pierrecdn

## 1.5.3 (September 24, 2018)

IMPROVEMENTS:

 * added to_a method to Arrays objects (ex: datacenters)
 * Improved Consul-UI templates to have proper list of DCs

## 1.5.2 (September 12, 2018)

IMPROVEMENTS:

 * added support for Weights in Consul-UI
 * new `debug/compare_connect_services.txt.erb`
 * new erb .map() function to iterate over all values

## 1.5.1 (September 4, 2018)

BUG FIXES:

 * fixed non valid regexp lookups in Consul-UI

IMPROVEMENTS:

 * Added Support for Consul Connect in Consul-UI

## 1.5.0 (August 17, 2018)

IMPROVEMENTS:

 * fixed small errors in documentation
 * added `-T` flag to control ERB trim mode with default value of `-`

## 1.4.0 (July 23, 2018)

IMPROVEMENTS:

 * minor fixes in samples
 * consul-ui now supports `#service_<service_name>` anchors

NEW FEATURES:

 * Support for Hashicorp Vault improvements thanks to [@uepoch](https://github.com/uepoch)

## 1.3.1 (June 19, 2018)

NEW FEATURES:

 * samples/consul-ui/ now displays Service Meta information (new in Consul 1.1)

## 1.3.0 (June 7, 2018)

IMPROVEMENTS:

 * samples/consul-ui/ now supports keys as well as nodes thanks to [@geobeau](https://github.com/geobeau)

NEW FEATURES:

 * EXPERIMENTAL Vault support thanks to [@uepoch](https://github.com/uepoch)

BUG FIXES:

 * Properly shutdown connections when receiving Posix signal to kill app

## 1.2.1 (May 28, 2018)

BUG FIXES:

 * cache for service was not properly taken into account

IMPROVEMENTS:

 * consul-ui now shows the number of service filetered
 * service.Meta is an object not an array when null (Consul < 1.1)

## 1.2.0 (May 25, 2018)

IMPROVEMENTS:

 * Added snode.service_address to get the IP address of a service easily
   without any logic in ERB files
 * Improved consul-ui, added a [README.md](samples/consul-ui/README.md)

## 1.1.3 (May 17, 2018)

IMPROVEMENTS:

 * Cleaner consul-ui with ability to filterr using tags and statuses

## 1.1.2 (May 17, 2018)

IMPROVEMENTS:

 * samples/consul-ui now display number of instances passing/warning/critical
 * samples/consul-ui allow to filter per status, tags or instance name
 * samples/consul-ui now display tags in list

## 1.1.1 (May 15, 2018)

IMPROVEMENTS:

 * Use 60 seconds of cleanup to avoid over-cleaning up endpoints
 * Use same environment variables to filter services in nodes.html.erb

## 1.1.0 (May 12, 2018)

BUG FIXES:

 * Fix crashes on Mac OS X by updating eventmachine to 1.2.7. See
   https://github.com/igrigorik/em-http-request/issues/315 for details

IMPROVEMENTS:

 * Minor typo fixes in documentation

## 1.0.11 (May 11, 2018)

BUG FIXES:

 * Fix for Mac OS X fixed in `1.2-stable` branch of
   [event-machine](https://github.com/eventmachine/eventmachine/), see
   https://github.com/igrigorik/em-http-request/issues/315 for more
   details
 * fixed bug in samples/sample_keys.html.erb
 * Unit tests now catches all `*.erb` files in subdirectories

IMPROVEMENTS:

 * Improved new samples/consul-ui/
 * Documentation typos
 * Help typos fixed
 * Various improvements in [samples/](samples/]

## 1.0.10 (May 4, 2018)

IMPROVEMENTS:

 * [samples/nodes.html.erb](samples/nodes.html.erb) now also displays the services
 * Added dynamic UI with JSON in directory [samples/consul-ui](samples/consul-ui)

## 1.0.9 (March 20, 2018)

IMPROVEMENTS:

* Added [samples/sample_keys.html.erb](samples/sample_keys.html.erb)
* When `get_value_json` is called, allow to catch silently errors
* Nicer error messages when templates are invalid with exact line of error
* Added optional params_file to `--template` flag to create parameters for templates
* Documentation improvements

## 1.0.8 (March 18, 2018)

IMPROVEMENTS:

* More clever behaviour regarding processes on First completed rendering phase
* All samples/*.html.erb templates are w3c compatibles without errors
* Look and features improvements for samples/*.html.erb
* Added optional parameters to sub-template in `render_file`
* Added `param(name, default_value)` to retrieve parameter from sub-template
* Use `CONSUL_HTTP_TOKEN` if present in environment variables to get the token
* Added [TemplateAPI.md](TemplateAPI.md) for documenting functions

## 1.0.7 (March 16, 2018)

BUG FIXES:

* Do not execute reload command at startup if destination file exists and is unchanged

IMPROVEMENTS:

* samples/*.html.erb files have doctype as first line

## 1.0.6 (March 16, 2018)

IMPROVEMENTS:

* Adds `http://` to Consul URL if missing since `$CONSUL_HTTP_ADDR` environment
  variable might not have it
* Updated gem description with more accurate information
* samples: removed KV/nodes from services.html.erb
* Fixed typos in README.md
* Added CHANGELOG.md

## 1.0.5 (March 12, 2018)

BUG FIXES:

* fixed default value for parameter -c to `http://localhost:8500`

## 1.0.4 (March 12, 2018)

BUG FIXES:

* First auto-built by Travis CI and fully deployed version
* Fixed String interpolation bug in help messages
* Bump rubocop to version 0.49.0 due to CVE (Travis CI)

IMPROVEMENTS:

* Various README.md improvements

## 1.0.0 -> 1.0.3 (March 12, 2018) First public release

BUG FIXES:

* Allow Travis to build properly using tags and publish to rubygems.org
