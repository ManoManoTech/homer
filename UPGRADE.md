# Upgrade to 1.x.x

## BC BREAK: removed default monitoring state exposure

Information exposed under `/api/monitoring/state` are not anymore available. It was unnecessary, [leaking possible private information](https://github.com/ManoManoTech/homer/issues/89) and requiring some dependencies.

## BC BREAK: update to Node v24

Docker Image and projects are now using `node` v24. Please update your related pipelines/actions/based images.
