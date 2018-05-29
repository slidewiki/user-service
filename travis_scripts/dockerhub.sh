#!/bin/bash
echo $DOCKER_PASSWORD | docker login -u="$DOCKER_USERNAME" --password-stdin
docker build --build-arg BUILD_ENV=travis -t slidewiki/userservice:latest-dev ./
docker push slidewiki/userservice:latest-dev
