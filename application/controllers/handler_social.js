/*
Handles the requests by executing stuff and replying to the client. Uses promises to get stuff done.
Instance for social function - handler.js got too big
*/

'use strict';

const boom = require('boom'), //Boom gives us some predefined http codes and proper responses
  co = require('../common'),
  userCtrl = require('../database/user'),
  providerCtrl = require('../database/provider'),
  config = require('../configuration'),
  jwt = require('./jwt'),
  socialProvider = require('./social_provider'),
  util = require('./util');

const PROVIDERS = ['github', 'google'];

module.exports = {
  //Uses provided token to get user data and stores plus response the userdata
  handleOAuth2Token: (req, res, provider) => {
    console.log('Got token from provider ', provider);

    return socialProvider.getUserCredentials(req.query.access_token, provider)
      .then((user) => {
        let data = {
          provider: provider,
          token: req.query.access_token,
          scope: req.query['raw[scope]'],
          expires: util.parseStringToInteger(req.query['raw[expires_in]']),
          extra_token: req.query['raw[id_token]'],  //atm just for google
          token_creation: (new Date()).toISOString(),
          // origin: { //TODO should be removed
          //   credentials: req.query,
          //   user: user.origin
          // },
          username: user.nickname,
          email: user.email,
          id: user.id.toString(),
          location: user.location,
          organization: user.organization,
          description: user.description,
          picture: user.picture,
          name: user.name
        };

        return providerCtrl.create(data)
        .then((result) => {
          // console.log('handleOAuth2Token: provider create result: ', result);

          if (result[0] !== undefined && result[0] !== null) {
            //Error
            return res(boom.badImplementation('Implementation error - data model error:', co.parseAjvValidationErrors(result)));
          }

          if (result.insertedCount === 1) {
            //success
            return res(data);
          }

          res(boom.badImplementation());
        });
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
    if (!isProviderSupported(util.parseAPIParameter(req.payload.provider)))
      return res(boom.notAcceptable('Provider is not supported'));

    let provider = {
      provider: util.parseAPIParameter(req.payload.provider),
      token: util.parseAPIParameter(req.payload.token),
      token_creation: util.parseAPIParameter(req.payload.token_creation),
      id: util.parseAPIParameter(req.payload.id),
      email:    util.parseAPIParameter(req.payload.email)
    };

    return providerCtrl.getIfValid(provider)
      .then((document) => {
        if (document === false)
          return res(boom.unauthorized('Wrong OAuth data'));

        const findQuery = {
          _id: req.auth.credentials.userid
        };
        const updateQuery = {
          $push: {
            providers: provider
          }
        };
        return userCtrl.partlyUpdate(findQuery, updateQuery)
          .then((result) => {
            console.log('handler: addProvider:',  result.result);

            if (result.result.ok !== 1)
              return res(boom.badImplementation());

            if (result.result.n === 1) {
              //success
              return res();
            }
            else {
              //not found
              return res(boom.notFound('User not found - check JWT'));
            }
          })
          .catch((error) => {
            res(boom.notFound('Adding provider failed', error));
          });
      })
      .catch((error) => {
        console.log('Error', error);
        res(boom.badImplementation(error));
      });
  },

  deleteProvider: (req, res) => {
    if (!isProviderSupported(util.parseAPIParameter(req.params.provider)))
      return res(boom.notAcceptable('Provider is not supported'));

    const findQuery = {
      _id: req.auth.credentials.userid
    };
    const updateQuery = {
      $pull: {
        providers: {
          provider: util.parseAPIParameter(req.params.provider)
        }
      }
    };
    const params = {
      multi: true
    };

    return userCtrl.partlyUpdate(findQuery, updateQuery, params)
      .then((result) => {
        console.log('handler: deleteProvider:',  result.result);

        if (result.result.ok !== 1)
          return res(boom.badImplementation());

        if (result.result.n === 1) {
          //success
          return res();
        }
        else {
          //not found
          return res(boom.notFound('Provider data not found'));
        }
      })
      .catch((error) => {
        res(boom.notFound('Deleting provider failed', error));
      });
  },

  //Use provider data and additionally user data to create an account - checks db if OAuth is correct
  registerWithOAuth: (req, res) => {
    if (!isProviderSupported(util.parseAPIParameter(req.payload.provider)))
      return res(boom.notAcceptable('Provider is not supported'));

    let provider = {
      provider: util.parseAPIParameter(req.payload.provider),
      token: util.parseAPIParameter(req.payload.token),
      token_creation: util.parseAPIParameter(req.payload.token_creation),
      id: util.parseAPIParameter(req.payload.id),
      email:    util.parseAPIParameter(req.payload.email)
    };

    return providerCtrl.getIfValid(provider)
      .then((document) => {
        if (document === false)
          return res(boom.unauthorized('Wrong OAuth data'));

        let user = {
          username: util.parseAPIParameter(req.payload.username) || document.username,
          email:    document.email,
          frontendLanguage: util.parseAPIParameter(req.payload.language),
          country: document.location || '',
          picture: document.picture || '',
          description: document.description || '',
          organization: document.organization || '',
          registered: (new Date()).toISOString(),
          forename: util.parseAPIParameter(req.payload.forename) || '',
          surname: util.parseAPIParameter(req.payload.surname) || '',
          providers: [
            {
              provider: document.provider,
              token: document.token,
              expires: document.expires || 0,
              token_creation: document.token_creation,
              scope: document.scope || '',
              extra_token: document.extra_token || '',
              id: document.id
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
      })
      .catch((error) => {
        console.log('Error', error);
        res(boom.badImplementation(error));
      });
  },

  loginWithOAuth: (req, res) => {
    if (!isProviderSupported(util.parseAPIParameter(req.payload.provider)))
      return res(boom.notAcceptable('Provider is not supported'));

    let provider = {
      provider: util.parseAPIParameter(req.payload.provider),
      token: util.parseAPIParameter(req.payload.token),
      token_creation: util.parseAPIParameter(req.payload.token_creation),
      id: util.parseAPIParameter(req.payload.id),
      email:    util.parseAPIParameter(req.payload.email)
    };

    return providerCtrl.getIfValid(provider)
      .then((document) => {
        if (document === false)
          return res(boom.unauthorized('Wrong OAuth data'));

        //get user with similar provider data
        const query = {
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

                return res({
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
            console.log('Error', error);
            res(boom.badImplementation(error));
          });
      })
      .catch((error) => {
        console.log('Error', error);
        res(boom.badImplementation(error));
      });
  }
};

function isProviderSupported(provider) {
  return PROVIDERS.indexOf(provider) !== -1;
}
