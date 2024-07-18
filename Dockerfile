FROM node:18

RUN mkdir -p /home/node/app \
    && chown -R node:node /home/node/app

WORKDIR /home/node/app

ENV NODE_ENV=production

EXPOSE 3000

USER node

COPY --chown=node:node dist /home/node/app/dist
COPY --chown=node:node node_modules /home/node/app/node_modules

CMD ["node", "dist/src/index.js"]
