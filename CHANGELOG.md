## (UNRELEASED)

IMPROVEMENTS:

* More clever behaviour regarding processes on First completed rendering phase

## 1.0.7 (March 16, 2018)

BUG FIXES:

* Do not execute reload command at startup if destination file exists and is unchanged

IMPROVEMENTS:

* samples/*.html.erb files have doctype as first line

## 1.0.6 (March 16, 2018)

IMPROVEMENTS:

* Adds http:// to Consul URL if missing since `$CONSUL_HTTP_ADDR` environment
  variable might not have it
* Updated gem description with more accurate information
* samples: removed KV/nodes from services.html.erb
* Fixed typos in README.md
* Added CHANGELOG.md

## 1.0.5 (March 12, 2018)

BUG FIXES:

* fixed default value for parameter -c to http://localhost:8500

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
