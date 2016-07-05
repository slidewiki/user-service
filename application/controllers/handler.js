/*
Handles the requests by executing stuff and replying to the client. Uses promises to get stuff done.
*/

'use strict';

const boom = require('boom'), //Boom gives us some predefined http codes and proper responses
  co = require('../common');

module.exports = {
  register: () => {

  },

  create: (req, res) => {
    res({
      new_id: '123L564890423454784012A4'
    });
  },

  getUser: () => {

  },

  updateUser: () => {

  },

  deleteUser: () => {

  },

  login: () => {

  },


};
