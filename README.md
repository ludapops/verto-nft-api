# Verto NFT Marketplace API

Serverless API implementation for Verto NFT Marketplace

# Dependencies

- [Serverless CLI](https://www.serverless.com/framework/docs)
  - Required to emulate local environment (serverless).

# Configuration

# 1. Database

You can configure your database URI for any development purpose by exporting an environment variable.

```shell
# Default: mongodb://localhost:27017/marketplace
export MONGO_URI = "mongodb://host:port/database";
```

# Development

```shell
yarn start
```


## Install requirements

```shell
yarn global add serverless
```

## Build

```shell
# Install dependencies
yarn

# Build project
yarn start
```

Endpoints are based on filename inside the `src/handler` folder.

# ...
```

# Production

## Deploy

Deploy to production should be triggered by a webhook when a commit, or a pull-request is merged to `master`.

If you need to force a deployment, use the following command:

```shell
serverless deploy
```
