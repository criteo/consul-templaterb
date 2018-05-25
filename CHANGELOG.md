# CHANGELOG

## (UNRELEASED)

IMPROVEMENTS:

 * Added snode.service_address to get the IP address of a service easily
   without any logic in ERB files

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
