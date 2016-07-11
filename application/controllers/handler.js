/*
Handles the requests by executing stuff and replying to the client. Uses promises to get stuff done.
*/

'use strict';

const boom = require('boom'), //Boom gives us some predefined http codes and proper responses
  co = require('../common');

module.exports = {
  register: (req, res) => {

  },

  create: (req, res) => {
    res({
      new_id: '123L564890423454784012A4'
    });
  },

  getUser: (req, res) => {

  },

  updateUser: (req, res) => {

  },

  deleteUser: (req, res) => {

  },

  login: (req, res) => {

  },


};
