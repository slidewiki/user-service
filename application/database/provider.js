'use strict';

const helper = require('./helper'),
  providerModel = require('../models/provider.js'),
  collectionName = 'oauthprovideruserdata';

module.exports = {
  create: (provider) => {
    return helper.connectToDatabase()
      .then((db) => db.collection(collectionName))
      .then((collection) => {
        let isValid = false;
        provider._id = newId;
        try {
          isValid = providerModel(provider);
          if (!isValid) {
            return providerModel.errors;
          }
          return collection.insertOne(provider);
        } catch (e) {
          console.log('provider validation failed', e);
          throw e;
        }
      });
  },

  find: (query) => {
    return helper.connectToDatabase()
      .then((dbconn) => dbconn.collection(collectionName))
      .then((collection) => collection.find(query));
  }
};
