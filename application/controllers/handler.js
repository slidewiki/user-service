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
      lastname: decodeURI(req.payload.name),
      username: decodeURI(req.payload.username),
      email: decodeURI(req.payload.email),
      password: decodeURI(req.payload.password),
      languages: [decodeURI(req.payload.language)],
      defaults: [{
        language: decodeURI(req.payload.language)
      }],
      registered: true
    };

    //check if username already exists
    return isUsernameAlreadyTaken(user.username)
    .then((isTaken) => {
      console.log('username already taken: ', user.username, isTaken);
      if (isTaken === false) {
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
      }
      else {
        return res(boom.badData('The username is already taken'));
      }
    })
    .catch((error) => {
      res(boom.badImplementation('Error', error));
    });
  },

  //used by authorization service - not needed for now
  create: (req, res) => {
    res({
      new_id: '123L564890423454784012A4'
    });
  },

  getUser: (req, res) => {
    return userCtrl.read(new mongodb.ObjectID(decodeURI(req.params.id)))
      .then((user) => {
        if (user !== undefined && user !== null && user.username !== undefined)
          res(user);
        else {
          res(boom.notFound());
        }
      })
      .catch((error) => {
        res(boom.notFound('Wrong user id', error));
      });
  },

  updateUser: (req, res) => {
    let user = req.payload;
    user._id = new mongodb.ObjectID(decodeURI(req.params.id));

    return userCtrl.update(user)
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

  deleteUser: (req, res) => {
    let userid = new mongodb.ObjectID(decodeURI(req.params.id));

    //check if the user which should be deleted have the right JWT data
    let jwt_data = '';
    try {
      jwt_data = req.auth.credentials.userid;
    }
    catch (e) {}
    //console.log(decodeURI(req.params.id), 'vs', jwt_data);
    if (decodeURI(req.params.id) !== jwt_data) {
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
  }
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
