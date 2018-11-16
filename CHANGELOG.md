# CHANGELOG

## (UNRELEASED)

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
