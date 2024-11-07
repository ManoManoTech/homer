# Get the most recent base image with the correct architecture from https://github.com/ManoManoTech/homer/pkgs/container/homer
FROM ghcr.io/manomanotech/homer:v0.3.0@sha256:ad5568ba02911beaf51633acd5bc63df8d815a07ea8953472ff9e4b7f1df4510

# Copy the configuration file and the plugins at the correct location
COPY config/ dist/config/
COPY plugins/ dist/plugins/

CMD ["node", "dist/src/index.js"]
