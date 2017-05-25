'use strict';

const userCtrl = require('../database/user'),
  Joi = require('joi');

module.exports = {
  isJWTValidForTheGivenUserId: (req) => {
    let jwt_userid = '';
    try {
      jwt_userid = req.auth.credentials.userid;
    } catch (e) {}
    //console.log(decodeURI(req.params.id), 'vs', jwt_data);
    if (decodeURI(req.params.id).toString() !== jwt_userid.toString()) {
      return false;
    }
    return true;
  },

  isIdentityAssigned: (email, username) => {
    let myPromise = new Promise((resolve, reject) => {
      // check for static users!!
      let staticUser = userCtrl.findStaticUserByName(username);
      if (staticUser) {
        return resolve({
          assigned: true,
          username: true,
          email: false,
        });
      }

      return userCtrl.find({
        $or: [
          {
            username: username
          },
          {
            email: email
          }
        ]
      })
        .then((cursor) => cursor.project({email: 1, username: 1}))
        .then((cursor2) => cursor2.toArray())
        .then((array) => {
          console.log('isIdentityAssigned: cursor.array.length:', array.length);

          if (array.length > 0) {
            const isEMailAssigned = !(array.reduce((prev, curr) => {
              const sameEMail = curr.email === email;
              return prev && !sameEMail;
            }, true));
            const isUsernameAssigned = !(array.reduce((prev, curr) => {
              const sameUsername = curr.username === username;
              return prev && !sameUsername;
            }, true));

            resolve({
              assigned: isEMailAssigned || isUsernameAssigned,
              username: isUsernameAssigned,
              email: isEMailAssigned
            });
          } else {
            resolve({assigned: false});
          }
        })
        .catch((error) => {
          reject(error);
        });
    });
    return myPromise;
  },

  parseAPIParameter: (parameter) => {
    if (parameter === undefined || parameter === null || parameter.toString().replace(' ', '') === '')
      return '';

    return decodeURI(parameter);
  },

  parseStringToInteger: (string) => {
    const integerSchema = Joi.number().integer();
    const validationResult = integerSchema.validate(string);
    if (validationResult.error === null) {
      return validationResult.value;
    }
    return undefined;
  }
};
