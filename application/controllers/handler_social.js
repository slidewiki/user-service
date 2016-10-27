/*
Handles the requests by executing stuff and replying to the client. Uses promises to get stuff done.
Instance for social function - handler.js got too big
*/

'use strict';

const boom = require('boom'), //Boom gives us some predefined http codes and proper responses
  co = require('../common'),
  userCtrl = require('../database/user'),
  config = require('../configuration'),
  jwt = require('./jwt'),
  socialProvider = require('./social_provider'),
  util = require('./util');

module.exports = {
  handleOAuth2Token: (req, res, provider) => {
    console.log('Got token from provider ', provider);

    return socialProvider.getUserCredentials(req.query.access_token, provider)
      .then((user) => {
        let result = {
          provider: provider,
          token: req.query.access_token,
          scope: req.query['raw[scope]'],
          expires: req.query['raw[expires_in]'],
          extra_token: req.query['raw[id_token]'],  //atm just for google
          token_creation: (new Date()).toISOString(),
          // origin: { //TODO should be removed
          //   credentials: req.query,
          //   user: user.origin
          // },
          username: user.nickname,
          email: user.email,
          id: user.id,
          location: user.location,
          organization: user.organization,
          description: user.description,
          picture: user.picture,
          name: user.name
        };

        res(result);
      })
      .catch((error) => {
        console.log('Error', error);

        if (error.wrongCredentials === true) {
          res(boom.unauthorized('The credentials are wrong', 'OAuth', { providerResponse: error.origin }));
        }
        else
          res(boom.badImplementation(error));
      });
  },

  addProvider: (req, res) => {
  },

  deleteProvider: (req, res) => {
  },

  registerWithOAuth: (req, res) => {
    let user = {
      username: util.parseAPIParameter(req.payload.username),
      email:    util.parseAPIParameter(req.payload.email),
      frontendLanguage: util.parseAPIParameter(req.payload.language),
      country: util.parseAPIParameter(req.payload.location),
      picture: util.parseAPIParameter(req.payload.picture),
      description: util.parseAPIParameter(req.payload.description),
      organization: util.parseAPIParameter(req.payload.organization),
      registered: (new Date()).toISOString(),
      providers: [
        {
          provider: util.parseAPIParameter(req.payload.provider),
          token: util.parseAPIParameter(req.payload.token),
          expires: req.payload.expires,
          token_creation: util.parseAPIParameter(req.payload.token_creation),
          scope: util.parseAPIParameter(req.payload.scope),
          extra_token: util.parseAPIParameter(req.payload.extra_token),
          id: util.parseAPIParameter(req.payload.id)
        }
      ]
    };
    console.log('Registration with OAuth data: ', user);

    //check if username already exists
    return util.isIdentityAssigned(user.email, user.username)
      .then((result) => {
        console.log('identity already taken: ', user.email, user.username, result);
        if (result.assigned === false) {
          return userCtrl.create(user)
            .then((result) => {
              // console.log('register: user create result: ', result);

              if (result[0] !== undefined && result[0] !== null) {
                //Error
                console.log('ajv error', result, co.parseAjvValidationErrors(result));
                return res(boom.badData('registration failed because data is wrong: ', co.parseAjvValidationErrors(result)));
              }

              if (result.insertedCount === 1) {
                //success
                return res({
                  userid: result.insertedId
                })
                .header(config.JWT.HEADER, jwt.createToken({
                  userid: result.insertedId,
                  username: user.username
                }));
              }

              res(boom.badImplementation());
            })
            .catch((error) => {
              console.log('register: catch: ', error);
              res(boom.badImplementation('Error', error));
            });
        } else {
          let message = 'The username and email is already taken';
          if (result.email === false)
            message = 'The username is already taken';
          if (result.username === false)
            message = 'The email is already taken';
          return res(boom.badData(message));
        }
      })
      .catch((error) => {
        res(boom.badImplementation('Error', error));
      });
  },

  loginWithOAuth: (req, res) => {
    const query = { //TODO wrong query have to be more accurate
      _id: req.payload.userid,
      email: decodeURI(req.payload.email),
      'providers.provider': decodeURI(req.payload.provider),
      'providers.id': decodeURI(req.payload.id)
    };

    return userCtrl.find(query)
      .then((cursor) => cursor.toArray())
      .then((result) => {
        //console.log('login: result: ', result);

        switch (result.length) {
          case 0:
            res(boom.unauthorized('The credentials are wrong', 'OAuth', { reason: 'No such userdata' }));
            break;
          case 1:
            //TODO: call authorization service for OAuth2 token

            if (result[0].deactivated === true) {
              res(boom.unauthorized('This user is deactivated.'));
              break;
            }

            res({
              userid: result[0]._id,
              username: result[0].username,
              access_token: 'dummy',
              expires_in: 0
            })
              .header(config.JWT.HEADER, jwt.createToken({
                userid: result[0]._id,
                username: result[0].username
              }));
            break;
          default:
            res(boom.badImplementation('Found multiple users'));
            break;
        }
      })
      .catch((error) => {
        res(boom.badImplementation(error));
      });
  }
};
