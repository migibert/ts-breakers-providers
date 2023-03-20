# ts-breakers-providers

This repository aims to enrich [ts-breakers](https://www.npmjs.com/package/ts-breakers) with Remote State providers.

Remote providers allow multiple instances of an application to share their state and configuration. 

Each directory in this repository matches one provider.

# CI

We use CircleCI as a CI provider. Each time a change is detected in a subdirectory, the associated pipeline runs.

Currently supported providers:
* [Redis](https://www.npmjs.com/package/ts-breakers-redis-provider)


# Adding a new provider

Here is the TODO list to add a new provider:
* Create a folder named `ts-breakers-<datasource>-provider`
* Add `ts-breakers` as a dependency and implement `CircuitBreakerStorageStrategy` interface
* Add your [mapping](https://github.com/migibert/ts-breakers-providers/blob/05110614f1a24082779d0d28ce2141de814d25ed/.circleci/config.yml#L15) to the CI configuration

