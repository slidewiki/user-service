#!/bin/bash
docker login -u="$DOCKER_USERNAME" -p="$DOCKER_PASSWORD"
docker build -t slidewiki/userservice:latest-dev ./
docker push slidewiki/userservice:latest-dev
