/*
Handles the requests by executing stuff and replying to the client. Uses promises to get stuff done.
*/

'use strict';

const boom = require('boom'), //Boom gives us some predefined http codes and proper responses
  co = require('../common'),
  userCtrl = require('../database/user'),
  mongodb = require('mongodb'),
  config = require('../configuration'),
  jwt = require('./jwt');

module.exports = {
  register: (req, res) => {
    let user = {
      surname: decodeURI(req.payload.surname),
      forename: decodeURI(req.payload.forename),
      username: decodeURI(req.payload.username),
      email: decodeURI(req.payload.email),
      password: decodeURI(req.payload.password),
      languages: [decodeURI(req.payload.language)],
      defaults: [{
        language: decodeURI(req.payload.language)
      }]
    };

    //check if username already exists
    return isUsernameAlreadyTaken(user.username)
      .then((isTaken) => {
        console.log('username already taken: ', user.username, isTaken);
        if (isTaken === false) {
          //TODO: check email

          return userCtrl.create(user)
            .then((result) => {
              //console.log('register: user create result: ', result);

              if (result[0] !== undefined && result[0] !== null) {
                //Error
                return res(boom.badData('registration failed because data is wrong: ', co.parseAjvValidationErrors(result)));
              }

              if (result.insertedCount === 1) {
                //success
                return res({
                  success: true,
                  userid: result.insertedId.toString()
                });
              }

              res(boom.badImplementation());
            })
            .catch((error) => {
              console.log('register: catch: ', error);
              res(boom.badImplementation('Error', error));
            });
        } else {
          return res(boom.badData('The username is already taken'));
        }
      })
      .catch((error) => {
        res(boom.badImplementation('Error', error));
      });
  },

  //used by authorization service - not needed for now, but needed for migration
  create: (req, res) => {
    let user = {
      email: decodeURI(req.payload.email),
      username: decodeURI(req.payload.username),
      password: decodeURI(req.payload.password),
      registered: decodeURI(req.payload.registered),
      surname: decodeURI(req.payload.last_name),
      forename: decodeURI(req.payload.first_name),
      gender: decodeURI(req.payload.gender),
      locale: decodeURI(req.payload.locale),
      hometown: decodeURI(req.payload.hometown),
      location: decodeURI(req.payload.location),
      picture: decodeURI(req.payload.picture),
      desription: decodeURI(req.payload.description),
      birthday: decodeURI(req.payload.birthday)
    };
    //check if username already exists
    return isUsernameAlreadyTaken(user.username)
      .then((isTaken) => {
        console.log('user already exists: ', user.username, isTaken);
        if (!isTaken) {
          //TODO: check email

          return userCtrl.create(user)
            .then((result) => {
              //console.log('register: user create result: ', result);

              if (result[0] !== undefined && result[0] !== null) {
                //Error
                return res(boom.badData('registration failed because data is wrong: ', co.parseAjvValidationErrors(result)));
              }

              if (result.insertedCount === 1) {
                //success
                return res({
                  success: true,
                  userid: result.insertedId.toString()
                });
              }

              res(boom.badImplementation());
            })
            .catch((error) => {
              console.log('register: catch: ', error);
              res(boom.badImplementation('Error', error));
            });
        } else {
          //update user instead of new
        }
      })
      .catch((error) => {
        res(boom.badImplementation('Error', error));
      });
  },

  login: (req, res) => {
    const query = {
      username: decodeURI(req.payload.username),
      password: decodeURI(req.payload.password)
    };

    return userCtrl.find(query)
      .then((cursor) => cursor.toArray())
      .then((result) => {
        //console.log('login: result: ', result);

        switch (result.length) {
          case 0:
            res(boom.notFound('credentials are wrong'));
            break;
          case 1:
            //TODO: call authorization service for OAuth2 token

            res({
              userid: result[0]._id.toString(),
              access_token: 'dummy',
              expires_in: 0
            })
              .header(config.JWT.HEADER, jwt.createToken({
                userid: result[0]._id.toString()
              }));
            break;
          default:
            res(boom.badImplementation('Found multiple users'));
            break;
        }
      })
      .catch((error) => {
        res(boom.notFound('Wrong user id', error));
      });
  },

  getUser: (req, res) => {
    //check if the request comes from the right user (have the right JWT data)
    const isUseridMatching = isJWTValidForTheGivenUserId(req);
    if (!isUseridMatching) {
      return res(boom.unauthorized('You cannot get detailed information about another user'));
    }

    return userCtrl.read(new mongodb.ObjectID(decodeURI(req.params.id)))
      .then((user) => {
        if (user !== undefined && user !== null && user.username !== undefined)
          res(prepareDetailedUserData(user));
        else {
          res(boom.notFound());
        }
      })
      .catch((error) => {
        res(boom.notFound('Wrong user id', error));
      });
  },

  deleteUser: (req, res) => {
    let userid = new mongodb.ObjectID(decodeURI(req.params.id));

    //check if the user which should be deleted have the right JWT data
    const isUseridMatching = isJWTValidForTheGivenUserId(req);
    if (!isUseridMatching) {
      return res(boom.unauthorized('You cannot delete another user'));
    }

    return userCtrl.delete(userid)
      .then((result) => {
        if (result.result.n === 1) {
          return res({
            success: true
          });
        }

        res(boom.notFound('Deletion failed - no matched id'));
      })
      .catch((error) => {
        res(boom.badImplementation('Deletion failed', error));
      });
  },

  //User profile
  updateUserPasswd: (req, res) => {
    let oldPassword = req.payload.oldPassword;
    let newPassword = req.payload.newPassword;
    user._id = new mongodb.ObjectID(decodeURI(req.params.id));

    //check if the user which should be updated have the right JWT data
    const isUseridMatching = isJWTValidForTheGivenUserId(req);
    if (!isUseridMatching) {
      return res(boom.unauthorized('You cannot change the password of another user'));
    }

    //check if old password is correct
    return userCtrl.find({
      _id: user._id,
      password: oldPassword
    })
      .then((result) => {
        switch (result.length) {
          case 0:
            res(boom.notFound('There is no user with that Id and this password'));
            break;
          case 1:
            const findQuery = {
                _id: user._id,
                password: oldPassword
              },
              updateQuery = {
                $set: {
                  password: newPassword
                }
              };

            return userCtrl.partlyUpdate(findQuery, updateQuery)
              .then((result) => {
                //console.log('handler: updateUserPasswd:',  result);
                if (result[0] !== undefined && result[0] !== null) {
                  //Error
                  return res(boom.badImplementation());
                }

                if (result.modifiedCount === 1) {
                  //success
                  return res();
                }

                res(boom.badImplementation());
              })
              .catch((error) => {
                res(boom.notFound('Update failed', error));
              });
            break;
          default:
            //should not happen
            res(boom.badImplementation('Found multiple users'));
            break;
        }
      });
  },

  updateUserProfile: (req, res) => {//TODO
    let user = req.payload;
    user._id = new mongodb.ObjectID(decodeURI(req.params.id));

    //check if the user which should be updated have the right JWT data
    const isUseridMatching = isJWTValidForTheGivenUserId(req);
    if (!isUseridMatching) {
      return res(boom.unauthorized('You cannot change the user profile of another user'));
    }

    const findQuery = {
        _id: user._id
      },
      updateQuery = {
        $set: {
          email: decodeURI(req.payload.email),
          username: decodeURI(req.payload.email),
          surname: decodeURI(req.payload.email),
          forename: decodeURI(req.payload.email),
          language: decodeURI(req.payload.email),
          hometown: decodeURI(req.payload.email),
          location: decodeURI(req.payload.email),
          picture: decodeURI(req.payload.email),
          desription: decodeURI(req.payload.email),
          birthday: decodeURI(req.payload.email)
        }
      };

    return userCtrl.partlyUpdate(user)
      .then((result) => {
        //console.log('handler: updateUser:', user,  result);
        if (result[0] !== undefined && result[0] !== null) {
          //Error
          return res(boom.badData('update failed because data is wrong: ', co.parseAjvValidationErrors(result)));
        }

        if (result.modifiedCount === 1) {
          //success
          return res({
            success: true,
            userid: result.ops[0]._id.toString()
          });
        }

        res(boom.badImplementation());
      })
      .catch((error) => {
        res(boom.notFound('Update failed', error));
      });
  },

  getPublicUser: () => {},
};

function isUsernameAlreadyTaken(username) {
  let myPromise = new Promise((resolve, reject) => {
    return userCtrl.find({
      username: username
    })
      .then((cursor) => cursor.count())
      .then((count) => {
        //console.log('isUsernameAlreadyTaken: cursor.count():', count);
        if (count > 0) {
          resolve(true);
        } else {
          resolve(false);
        }
      })
      .catch((error) => {
        reject(error);
      });
  });
  return myPromise;
}

//Remove attributes of the user data object which should not be transmitted
function prepareDetailedUserData(user) {
  const hiddenKeys = ['password'];
  let minimizedUser = {};

  let key;
  for (key in user) {
    const found = hiddenKeys.find((hiddenKey) => {
      if (key === hiddenKey)
        return true;

      return false;
    });
    if (found === false || found === null) {
      minimizedUser[key] = user[key];
    }
  }

  return minimizedUser;
}

function isJWTValidForTheGivenUserId(req) {
  let jwt_userid = '';
  try {
    jwt_userid = req.auth.credentials.userid;
  } catch (e) {}
  //console.log(decodeURI(req.params.id), 'vs', jwt_data);
  if (decodeURI(req.params.id) !== jwt_userid) {
    return false;
  }
  return true;
}
