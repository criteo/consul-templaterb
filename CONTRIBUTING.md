# How to contribute to Consul-Templaterb ?

## Architecxture Overview

Please read [INTERNALS.md](INTERNALS.md) to understand how it works.

## Samples

The [samples/](samples/) directory contains lots of useable templates that might help others using your new features.
Keep them less specific as possible (for instance use environment variables to allow others to use it directly
without relying on a specic path in KV).

Read first [TemplateAPI.md](TemplateAPI.md) to ensure you are using the best functions for the job, the API is kept
compact and powerful with many examples.

All the samples are unit-tested, so launch rspec before commiting, a template not converging will not be merged.

## Want new features/Found a bug?

[Report it](https://github.com/criteo/consul-templaterb/issues), but read carefully [TemplateAPI.md](TemplateAPI.md) and
[README.md](README.md)

## Want to add features/fix a bug?

Contributions in code are welcomed, create a fork and then a Pull Request, we will review it quickly.
