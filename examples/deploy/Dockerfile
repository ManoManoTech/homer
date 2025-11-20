# Get the most recent base image with the correct architecture from https://github.com/ManoManoTech/homer/pkgs/container/homer
FROM ghcr.io/manomanotech/homer:v2.0.0-RC3

# Copy the configuration file and the plugins at the correct location
COPY --chown=homer:homer config/ dist/config/
COPY --chown=homer:homer plugins/ dist/plugins/

USER homer
