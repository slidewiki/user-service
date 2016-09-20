#!/bin/bash
echo $DOCKER_USERNAME
echo $DOCKER_PASSWORD
docker login -e="$DOCKER_EMAIL" -u="$DOCKER_USERNAME" -p="$DOCKER_PASSWORD"
docker build -t slidewiki/userservice ./
docker push slidewiki/userservice
