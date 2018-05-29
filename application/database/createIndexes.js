'use strict';

const helper = require('./helper');

// this function should include commands that create indexes (if any)
// for any collections that the service may be using

// it should always return a promise
module.exports = function() {

  // SAMPLE CODE
  return helper.getCollection('users').then((decks) => {
    return decks.createIndexes([
      { key: {'username': 1} },
      { key: {'email': 1, 'password': 1} }
    ]);
  });

};
