/*
This controller handles stuff for JWT.
Atm we save the userid because just the delete operation for a user is restricted.
*/
'use strict';

const jwt = require('jsonwebtoken'),
  config = require('../configuration');

module.exports = {

  validate: (decoded, request, callback) => {
    let isValid = false;
    if ((decoded.userid !== undefined && decoded.userid !== null) && (decoded.username !== undefined && decoded.username !== null))
      isValid = true;
    else
      console.log('JWT Data is NOT valid:', decoded);
    callback(null, isValid);
  },

  createLTIToken: (data) => {
    return jwt.sign(data, config.JWT.SERIAL, {
      algorithm: config.JWT.ALGORITHM,
      // expiresIn: 60 * 60 * 24 * 2 //two days
    });
  },

  createToken: (user) => {
    let data = {
      userid: user._id,
      username: user.username,
      email: user.email,
      isReviewer: user.isReviewer || false,
    };

    return jwt.sign(data, config.JWT.SERIAL, {
      algorithm: config.JWT.ALGORITHM,
      // expiresIn: 60 * 60 * 24 * 2 //two days
    });

  },

};
