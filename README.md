# User Management Service #
[![Build Status](https://travis-ci.org/slidewiki/user-service.svg?branch=master)](https://travis-ci.org/slidewiki/user-service)
[![License](https://img.shields.io/badge/License-MPL%202.0-green.svg)](https://github.com/slidewiki/microservice-template/blob/master/LICENSE)
[![Language](https://img.shields.io/badge/Language-Javascript%20ECMA2015-lightgrey.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Framework](https://img.shields.io/badge/Framework-NodeJS%206.9-blue.svg)](https://nodejs.org/)
[![Webserver](https://img.shields.io/badge/Webserver-Hapi%2016.4.3-blue.svg)](http://hapijs.com/)

This service manages the user accounts in terms of CRUD operations with their credentials, information and groups.
Also there are routes for handling social login with facebook, google and github, via OAuth2.

## API:

See https://userservice.experimental.slidewiki.org/documentation

## Side effects

The docker container of this services uses supervisord in order to run the NodeJS application and doing a periodically cleanup of the database (only collections which are in the domain of this service) in parallel.

## Social login

Using the SlideWiki platform to start social login, this service gets the tokens and manages them.
These social logins are used to sign up or sign in a SlideWiki user.
As this service communicates with the social providers in order to fulfill the OAuth2 workflow and request user information, the credentials for the providers are stored in the application/config.json file.
application/config.tpl is a template of such a configuration file - there are just the identifiers and secrets missing.
In order to get these identifiers and secrets, for each provider an application must be created, activated for OAuth2 and configured for the target domain:

* Facebook: https://developers.facebook.com/
* Github: Under /settings/applications of your organization or repository
* Google: https://console.developers.google.com

In there the allowed callback URLs have to be defined.
Their structure is: http(s)://your.domain.ending/connect/providername/callback , e.g. http://userservice.experimental.slidewiki.org/connect/github/callback

## Installation and running (in a container, works both on unix and Windows):

1. git clone http://github.com/slidewiki/user-service
2. cd user-service/
3. docker build -t test-user-service .
4. docker run -d --name mongodb mongo
5. docker run -it --rm -p 8880:3000 test-user-service
6. the service will be available at localhost:8880 with the documentation available at localhost:8880/documentation
