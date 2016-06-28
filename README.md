# User Management Service #
[![Build Status](https://travis-ci.org/slidewiki/user-service.svg?branch=master)](https://travis-ci.org/slidewiki/user-service)
[![License](https://img.shields.io/badge/License-MPL%202.0-green.svg)](https://github.com/slidewiki/microservice-template/blob/master/LICENSE)
[![Language](https://img.shields.io/badge/Language-Javascript%20ECMA2015-lightgrey.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Framework](https://img.shields.io/badge/Framework-NodeJS%206.2.0-blue.svg)](https://nodejs.org/)
[![Webserver](https://img.shields.io/badge/Webserver-Hapi%2013.4.0-blue.svg)](http://hapijs.com/)

This service manages the user accounts in terms of CRUD operations with their credentials and informations.
There is a collaboration with the authentification service, with handles OAuth2.
The API is just a draft.

API:

user

&nbsp;&nbsp;&nbsp;        delete /user/{id}

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;            Delete a user

&nbsp;&nbsp;&nbsp;        get /user/{id}

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;            Get user by id

&nbsp;&nbsp;&nbsp;        put /user/{id}

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;            Update a user

login

&nbsp;&nbsp;&nbsp;        post /login

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;            Login

register

&nbsp;&nbsp;&nbsp;        post /register

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;            Register a new user
