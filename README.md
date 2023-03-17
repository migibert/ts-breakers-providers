# ts-breakers-providers

This respository aims to enrich [ts-breakers](https://www.npmjs.com/package/ts-breakers) with Remote State providers.

Remote providers allow multiple instances of an application to share their state and configuration. 

Each directory in this repository matches one provider.

# CI

We use CircleCI as a CI provider. Each time a change is detected in a subdirectory, the associated pipeline runs.

Currently supported providers:
* [Redis](https://www.npmjs.com/package/ts-breakers-redis-provider)
