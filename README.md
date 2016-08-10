# User Management Service #
[![Build Status](https://travis-ci.org/slidewiki/user-service.svg?branch=master)](https://travis-ci.org/slidewiki/user-service)
[![License](https://img.shields.io/badge/License-MPL%202.0-green.svg)](https://github.com/slidewiki/microservice-template/blob/master/LICENSE)
[![Language](https://img.shields.io/badge/Language-Javascript%20ECMA2015-lightgrey.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Framework](https://img.shields.io/badge/Framework-NodeJS%206.2.0-blue.svg)](https://nodejs.org/)
[![Webserver](https://img.shields.io/badge/Webserver-Hapi%2013.4.0-blue.svg)](http://hapijs.com/)

This service manages the user accounts in terms of CRUD operations with their credentials and informations.
There is a collaboration with the authentification service, with handles OAuth2.
The API is just a draft.

##API:

See http://userservice.manfredfris.ch/documentation

##Installation and running (in a container, works both on unix and Windows):

1. git clone http://github.com/slidewiki/user-service
2. cd user-service/
3. docker build -t test-user-service .
4. docker run -d --name mongodb mongo
5. docker run -it --rm -p 8880:3000 test-user-service
6. the service will be available at localhost:8880 with the documentation available at localhost:8880/documentation
