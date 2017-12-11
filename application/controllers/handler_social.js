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
  request = require('request'),
  socialProvider = require('./social_provider'),
  util = require('./util'),
  instances = require('../configs/instances.js');

const PROVIDERS = ['github', 'google', 'facebook'],
  PLATFORM_SOCIAL_URL = require('../configs/microservices').platform.uri + '/socialLogin',
  PLATFORM_MIGRATE_URL = require('../configs/microservices').platform.uri + '/migrateUser',
  PLATFORM_INFORMATION_URL = require('../configs/microservices').platform.uri + '';

module.exports = {
  //Uses provided token to get user data and stores plus response the userdata
  handleOAuth2Token: (req, res, provider) => {
    console.log('Got token from provider ', provider);
    // console.log(req.query);

    return socialProvider.getUserCredentials(req.query.access_token, provider)
      .then((user) => {
        if (user === {} || user.email === user.nickname) {
          return res(boom.badImplementation());
        }

        let data = {
          provider: provider,
          token: req.query.access_token,
          scope: req.query['raw[scope]'] || user.scope,
          expires: util.parseStringToInteger(req.query['raw[expires_in]'] || req.query['raw[expires]']),
          extra_token: req.query['raw[id_token]'],  //atm just for google
          token_creation: (new Date()).toISOString(),
          // origin: { //TODO should be removed
          //   credentials: req.query,
          //   user: user.origin
          // },
          username: user.nickname.replace(/\s/g,''),
          email: user.email,
          id: user.id.toString(),
          location: user.location,
          organization: user.organization,
          description: user.description,
          picture: user.picture,
          name: user.name,
          forename: user.forename,
          surname:  user.surname,
          identifier: user.identifier
        };

        // console.log('handleOAuth2Token: created data', data);

        return providerCtrl.create(data)
          .then((result) => {
            console.log('handleOAuth2Token: provider create result: ', result.result, result.insertedCount);

            if (result[0] !== undefined && result[0] !== null) {
              //Error
              return res(boom.badImplementation('Implementation error - data model error:', co.parseAjvValidationErrors(result)));
            }

            if (result.insertedCount === 1) {
              //success
              return res()
                .redirect(PLATFORM_SOCIAL_URL + '?data=' + encodeURIComponent(JSON.stringify(data)))
                .temporary(true);
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
      identifier: util.parseAPIParameter(req.payload.identifier),
      email:    util.parseAPIParameter(req.payload.email)
    };

    return providerCtrl.getIfValid(provider)
      .then((document) => {
        if (document === false)
          return res(boom.unauthorized('Wrong OAuth data'));

        //check if provider already used by someone (use attributes: provider, email)
        return isProviderAlreadyUsedBySomeone(document)
          .then((data) => {
            if (data.inUse) {
              return res(boom.conflict('The social provider is already used by someone else.'));
            }

            //delete old provider data
            let findQuery = {
              _id: req.auth.credentials.userid
            };
            let updateQuery = {
              $pull: {
                providers: {
                  provider: provider.provider
                }
              }
            };
            const params = {
              multi: true
            };

            return userCtrl.partlyUpdate(findQuery, updateQuery, params)
              .then((result) => {
                console.log('handler: addProvider: cleared',  result.result);

                if (result.result.ok !== 1)
                  return res(boom.badImplementation());

                provider.expires = document.expires;
                provider.extra_token = document.extra_token;
                provider.scope = document.scope;

                findQuery = {
                  _id: req.auth.credentials.userid
                };
                updateQuery = {
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
                res(boom.notFound('Precondition clearing providers failed', error));
              });
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
        console.log('Error while deleting provider with userid '+req.auth.credentials.userid+':', error, 'used updateQuery:', updateQuery);
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
      identifier: util.parseAPIParameter(req.payload.identifier)
      // email:    util.parseAPIParameter(req.payload.email)  //email could be changed by the user
    };

    return providerCtrl.getIfValid(provider)
      .then((document) => {
        if (document === false)
          return res(boom.unauthorized('Wrong OAuth data'));

        //check if provider already used by someone (use attributes: provider, email)
        return isProviderAlreadyUsedBySomeone(document)
          .then((data) => {
            if (data.inUse) {
              if (data.deactivated)
                return res(boom.locked('The user with this provider assigned is deactivated.'));
              return res(boom.conflict('The social provider is already used by someone else.'));
            }

            let user = {
              username:         util.parseAPIParameter(req.payload.username).replace(/\s/g,'') || document.username.replace(/\s/g,''),
              email:            util.parseAPIParameter(req.payload.email).toLowerCase(),
              frontendLanguage: 'en',
              spokenLanguages: [util.parseAPIParameter(req.payload.language)],
              country:          document.location || '',
              picture:          document.picture || '',
              description:      document.description || '',
              organization:     document.organization || '',
              registered:       (new Date()).toISOString(),
              forename:         util.parseAPIParameter(req.payload.forename) || '',
              surname:          util.parseAPIParameter(req.payload.surname) || '',
              providers: [
                {
                  provider:       document.provider,
                  token:          document.token,
                  expires:        document.expires || 0,
                  token_creation: document.token_creation,
                  scope:          document.scope || '',
                  extra_token:    document.extra_token || '',
                  id:             document.id,
                  email:          document.email,
                  identifier:     document.identifier
                }
              ],
              authorised: true
            };
            console.log('Registration with OAuth data: ', user.username, user.email, user.providers[0].identifier);

            //check if username already exists
            return util.isIdentityAssigned(user.email, user.username)
              .then((result) => {
                console.log('identity already taken: ', user.email, user.username, result);
                if (result.assigned === false) {
                  //Send email before creating the user
                  return util.sendEMail(user.email,
                    'Your new account on SlideWiki',
                    'Dear '+user.forename+' '+user.surname+',\n\nwelcome to SlideWiki! You have registered your account with the username '+user.username+'. In order to start using your account and learn how get started with the platform please navigate to the following link:\n\n'+PLATFORM_INFORMATION_URL+'/welcome\n\nGreetings,\nthe SlideWiki Team')
                    .then(() => {
                      return userCtrl.create(user)
                        .then((result) => {
                          // console.log('social register: user create result: ', result);

                          if (result[0] !== undefined && result[0] !== null) {
                            //Error
                            console.log('ajv error', result, co.parseAjvValidationErrors(result));
                            return res(boom.badData('registration failed because data is wrong: ', co.parseAjvValidationErrors(result)));
                          }

                          if (result.insertedCount === 1) {
                            //success
                            user._id = result.insertedId;

                            return res({
                              userid: result.insertedId,
                              username: user.username,
                              access_token: 'dummy',
                              expires_in: 0
                            })
                              .header(config.JWT.HEADER, jwt.createToken(user));
                          }

                          res(boom.badImplementation());
                        })
                        .catch((error) => {
                          delete user.providers[0].token;
                          delete user.providers[0].extra_token;
                          console.log('Error - create user failed:', error, 'used user object:', user);
                          res(boom.badImplementation('Error', error));
                        });
                    })
                    .catch((error) => {
                      console.log('Error sending the email:', error);
                      return res(boom.badImplementation('Error', error));
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
                console.log('Error - util.isIdentityAssigned('+user.email+', '+user.username+') failed:', error);
                res(boom.badImplementation('Error', error));
              });
          });
      })
      .catch((error) => {
        delete provider.token;
        console.log('Error - providerCtrl.getIfValid or isProviderAlreadyUsedBySomeone failed:', error, 'used provider:', provider);
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
      identifier: util.parseAPIParameter(req.payload.identifier),
      email:    util.parseAPIParameter(req.payload.email)
    };

    return providerCtrl.getIfValid(provider)
      .then((document) => {
        if (document === false)
          return res(boom.unauthorized('Wrong OAuth data'));

        //get user with similar provider data
        const query = {
          'providers.identifier': document.identifier,
          'providers.provider': document.provider,
          // 'providers.id': decodeURI(req.payload.id) //using github the id could be changed
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

                if (result[0].suspended === true) {
                  res(boom.forbidden('The user is marked as SPAM.'));
                  break;
                }

                return res({
                  userid: result[0]._id,
                  username: result[0].username,
                  access_token: 'dummy',
                  expires_in: 0
                })
                  .header(config.JWT.HEADER, jwt.createToken(result[0]));
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
  },

  getProvidersOfUser: (req, res) => {
    const isUseridMatching = util.isJWTValidForTheGivenUserId(req);
    if (!isUseridMatching) {
      return res(boom.unauthorized('You cannot get the used providers of another user'));
    }

    return userCtrl.read(req.auth.credentials.userid)
      .then((user) => {
        if (user === undefined || user === null || user._id === undefined)
          return res(boom.notFound());

        let providers = user.providers.reduce((prev, cur) => {
          if (prev.indexOf(cur.provider) === -1) {
            prev.push(cur.provider);
            return prev;
          }
          return prev;
        }, []);

        return res(providers);
      });
  },

  slidewiki: (req, res) => {
    if (!instances[req.query.instance]) {
      return res(boom.notFound('Instance unknown.'));
    }

    //get detailed user
    const options = {
      url: instances[req.query.instance].userinfo.replace('{id}', req.query.userid),
      method: 'GET',
      json: true,
      headers: {
        '----jwt----': req.query.jwt
      }
    };

    function callback(error, response, body) {
      console.log('got detailed user: ', error, response.statusCode, body, options);

      if (!error && (response.statusCode === 200)) {
        let user = body;
        user.userid = user._id + 0;
        user._id = undefined;

        //check if user is already migrated
        userCtrl.find({
          migratedFrom: {
            instance: req.query.instance,
            userid: req.query.userid
          }
        })
          .then((cursor) => cursor.toArray())
          .then((array) => {
            if (array === undefined || array === null || array.length < 1) {
              //now migrate it
              return migrateUser(req, res, user);
            }
            else {
              //do a sign in
              return signInMigratedUser(req, res, user, array[0]);
            }
          });
      } else {
        console.log('Error', (response) ? response.statusCode : undefined, error, body);
        return res(boom.badImplementation('Failed to retrieve user data')); //TODO redirect to homepage?
      }
    }

    if (process.env.NODE_ENV === 'test') {
      callback(null, {statusCode: 200}, {});
    }
    else
      request(options, callback);
  },

  finalizeUser: (req, res) => {
    return util.isIdentityAssigned(req.payload.email, req.payload.username)
      .then((result) => {
        if (result.assigned) {
          return res(boom.conflict());
        }

        return userCtrl.find({_id: req.params.hash}, true)
          .then((cursor) => cursor.toArray())
          .then((result) => {
            //console.log('finalizeUser: result: ', result);

            switch (result.length) {
              case 0: return res(boom.notFound());
                break;
              case 1: let user = result[0];
                user.username = req.payload.username;
                user.email = req.payload.email;
                user._id = undefined;

                console.log('create new user');
                //save the user as a new one
                //Send email before creating the user
                return util.sendEMail(user.email,
                  'Your new account on SlideWiki',
                  'Dear '+user.forename+' '+user.surname+',\n\nwelcome to SlideWiki! You have migrated your account with the username '+user.username+' from '+instances[user.migratedFrom.instance].url+' to '+instances[instances._self].url+'. In order to start using your account and learn how get started with the platform please navigate to the following link:\n\n'+PLATFORM_INFORMATION_URL+'/welcome\n\nGreetings,\nthe SlideWiki Team')
                  .then(() => {
                    return userCtrl.create(user)
                      .then((result) => {
                        console.log('migrated user: create result: ', result.result);

                        if (result[0] !== undefined && result[0] !== null) {
                          //Error
                          console.log('ajv error', result, co.parseAjvValidationErrors(result));
                          return res(boom.badImplementation('registration failed because data is wrong: ' + co.parseAjvValidationErrors(result)));
                        }

                        if (result.insertedCount === 1) {
                          //success
                          user._id = result.insertedId;

                          return res({
                            userid: result.insertedId,
                            username: user.username
                          })
                            .header(config.JWT.HEADER, jwt.createToken(user));
                        }

                        res(boom.badImplementation());
                      })
                      .catch((error) => {
                        console.log('Error - create user failed:', error, 'used user object:', user);
                        res(boom.badImplementation('Error', error));
                      });
                  })
                  .catch((error) => {
                    console.log('Error sending the email:', error);
                    return res(boom.badImplementation('Error', error));
                  });
                break;
              default: return res(boom.badImplementation())
            };
          });
      });
  }
};

function migrateUser(req, res, user) {
  console.log('migrateUser()');
  user.migratedFrom = {
    instance: req.query.instance,
    userid: user.userid + 0
  };
  user.userid = undefined;
  user.reviewed = undefined;
  user.suspended = undefined;
  user.lastReviewDoneBy = undefined;
  user.registered = (new Date()).toISOString();

  return userCtrl.find({
    $or: [
      {
        username: user.username
      },
      {
        email: user.email
      }
    ]
  })
  .then((cursor) => cursor.toArray())
  .then((array) => {
    if (array === undefined || array === null || array.length < 1) {
      console.log('create new user');
      //save the user as a new one
      //Send email before creating the user
      return util.sendEMail(user.email,
        'Your new account on SlideWiki',
        'Dear '+user.forename+' '+user.surname+',\n\nwelcome to SlideWiki! You have migrated your account with the username '+user.username+' from '+instances[req.query.instance].url+' to '+instances[instances._self].url+'. In order to start using your account and learn how get started with the platform please navigate to the following link:\n\n'+PLATFORM_INFORMATION_URL+'/welcome\n\nGreetings,\nthe SlideWiki Team')
        .then(() => {
          return userCtrl.create(user)
            .then((result) => {
              console.log('migrated user: create result: ', result.result);

              if (result[0] !== undefined && result[0] !== null) {
                //Error
                console.log('ajv error', result, co.parseAjvValidationErrors(result));
                return res(boom.badImplementation('registration failed because data is wrong: ' + co.parseAjvValidationErrors(result)));
              }

              if (result.insertedCount === 1) {
                //success
                user._id = result.insertedId;

                return res()
                  .redirect(PLATFORM_MIGRATE_URL + '?data=' + encodeURIComponent(JSON.stringify({
                    userid: result.insertedId,
                    username: user.username,
                    jwt: jwt.createToken(user)
                  })))
                  .temporary(true);
              }

              res(boom.badImplementation());
            })
            .catch((error) => {
              console.log('Error - create user failed:', error, 'used user object:', user);
              res(boom.badImplementation('Error', error));
            });
        })
        .catch((error) => {
          console.log('Error sending the email:', error);
          return res(boom.badImplementation('Error', error));
        });
    }
    else {
      console.log('save user temp.');
      //save user temp. to change username
      userCtrl.create(user, true)
        .then((result) => {
          if (result[0] !== undefined && result[0] !== null) {
            //Error
            console.log('ajv error', result, co.parseAjvValidationErrors(result));
            return res(boom.badData('migration failed because data is wrong: ', co.parseAjvValidationErrors(result)));
          }

          if (result.insertedCount === 1) {
            //success
            user._id = result.insertedId;

            return res()
              .redirect(PLATFORM_MIGRATE_URL + '?data=' + encodeURIComponent(JSON.stringify({
                hash: result.insertedId,
                username: user.username,
                email: user.email
              })))
              .temporary(true);
          }

          res(boom.badImplementation());
        });
    }
  });
}

function signInMigratedUser(req, res, userFromOtherInstance, userFromThisInstance) {
  console.log('signInMigratedUser()');

  //TODO update userFromThisInstance?
  return res()
    .redirect(PLATFORM_MIGRATE_URL + '?data=' + encodeURIComponent(JSON.stringify({
      userid: userFromThisInstance._id,
      username: userFromThisInstance.username,
      jwt: jwt.createToken(userFromThisInstance)
    })))
    .temporary(true);
}

function isProviderSupported(provider) {
  return PROVIDERS.indexOf(provider) !== -1;
}

function isProviderAlreadyUsedBySomeone(provider) {
  let promise = new Promise((resolve, reject) => {
    return userCtrl.find({
      'providers.provider': provider.provider,
      'providers.identifier': provider.identifier
    })
      .then((cursor) => cursor.toArray())
      .then((array) => {
        return resolve({
          inUse: array.length > 0,
          deactivated: (array[0]) ? array[0].deactivated : false
        });
      })
      .catch((error) => {reject(error);});
  });

  return promise;
}
