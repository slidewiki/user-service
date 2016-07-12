/*
Handles the requests by executing stuff and replying to the client. Uses promises to get stuff done.
*/

'use strict';

const boom = require('boom'), //Boom gives us some predefined http codes and proper responses
  co = require('../common'),
  userCtrl = require('../database/user'),
  mongodb = require('mongodb');

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

    //Todo: check if username already exists

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
            userid: result.insertedId
          });
        }

        res(boom.badImplementation());
      })
      .catch((error) => {
        console.log('register: catch: ', error);
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
        res(user);
      })
      .catch((error) => {
        res(boom.notFound('Wrong user id', error));
      });
  },

  updateUser: (req, res) => {
    let user = req.payload;
    user._id = req.params.id;

    return userCtrl.update(user)
      .then((result) => {
        if (result[0] !== undefined && result[0] !== null) {
          //Error
          return res(boom.badData('update failed because data is wrong: ', co.parseAjvValidationErrors(result)));
        }

        if (result.modifiedCount === 1) {
          //success
          return res({
            success: true,
            userid: result.ops[0]._id
          });
        }

        res(boom.badImplementation());
      })
      .catch((error) => {
        res(boom.notFound('Update failed', error));
      });
  },

  deleteUser: (req, res) => {
    let userid = req.params.id;
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
              userid: result[0]._id,
              access_token: '',
              expires_in: 0
            });
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
