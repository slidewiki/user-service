FROM node:8-slim
MAINTAINER Kurt Junghanns <kjunghanns@informatik.uni-leipzig.de>

ARG BUILD_ENV=local
ENV BUILD_ENV ${BUILD_ENV}

RUN mkdir /nodeApp
WORKDIR /nodeApp

# --------------------- #
#   Installation Cron   #
# --------------------- #

RUN apt-get update
RUN apt-get install -y cron supervisor

# ----------------------- #
#   Installation NodeJS   #
# ----------------------- #

ADD ./application/ ./
RUN if [ "$BUILD_ENV" = "travis" ] ; then npm prune --production ; else rm -R node_modules ; npm install --production ; fi

# ---------------------- #
#   Configuration Cron   #
# ---------------------- #

RUN mkdir -p /var/log/supervisor && touch /var/log/cron.log

ADD supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Add crontab file in the cron directory
ADD crontab /etc/cron.d/simple-cron
ADD application/cleanup.sh /cleanup.sh

RUN chmod +x /cleanup.sh && chmod 0644 /etc/cron.d/simple-cron

# ----------- #
#   Cleanup   #
# ----------- #

RUN apt-get autoremove -y && apt-get -y clean && \
		rm -rf /var/lib/apt/lists/*

# -------- #
#   Run!   #
# -------- #

Entrypoint []
CMD supervisord
