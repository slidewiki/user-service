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
  },

  //Returns false if provider is not valid, otherwise the provider is returned
  getIfValid: (provider) => {
    const query = {
      provider: provider.provider,
      identifier: provider.identifier,
      token: provider.token,
      token_creation: provider.token_creation
    };
    if (provider.email)
      query.email = provider.email;
    console.log('getIfValid: search for', query);

    return helper.connectToDatabase()
      .then((dbconn) => dbconn.collection(collectionName))
      .then((collection) => collection.find(query))
      .then((cursor) => {
        return cursor.count()
          .then((count) => {
            if (count !== 1)
              return false;

            return cursor.next()
              .then((document) => {
                console.log('provider.js isValid() got document', document);
                let expires = 86400;
                if (document.expires !== undefined && document.expires !== null )
                  expires = document.expires;
                let millis = (new Date(document.token_creation)).getTime() + expires*1000;

                return (millis > (new Date()).getTime()) ? document : false;
              });
          });
      });
  },

  delete: (provider) => {
    return helper.connectToDatabase()
      .then((dbconn) => dbconn.collection(collectionName))
      .then((collection) => collection.deleteOne({
        provider: provider.provider,
        token: provider.token,
        token_creation: provider.token_creation
      }));
  }
};
