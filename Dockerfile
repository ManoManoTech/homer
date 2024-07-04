FROM arm64v8/node:18

RUN mkdir -p /home/node/app \
    && chown -R node:node /home/node/app

WORKDIR /home/node/app

ENV NODE_ENV=production

EXPOSE 3000

USER node

COPY --chown=node:node package.json /home/node/app/package.json
COPY --chown=node:node yarn.lock /home/node/app/yarn.lock
COPY --chown=node:node dist /home/node/app/dist

RUN yarn install

CMD ["node", "dist/src/index.js"]
