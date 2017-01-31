'use strict';

const helper = require('./helper'),
  userModel = require('../models/user.js'),
  collectionName = 'users';

module.exports = {
  create: (user) => {
    return helper.connectToDatabase()
      .then((dbconn) => helper.getNextIncrementationValueForCollection(dbconn, collectionName))
      .then((newId) => {
        // console.log('newId', newId);
        return helper.connectToDatabase() //db connection have to be accessed again in order to work with more than one collection
          .then((db2) => db2.collection(collectionName))
          .then((collection) => {
            let isValid = false;
            user._id = newId;
            try {
              isValid = userModel(user);
              if (!isValid) {
                return userModel.errors;
              }
              return collection.insertOne(user);
            } catch (e) {
              console.log('user validation failed', e);
              throw e;
            }
          }); //id is created and concatinated automatically
      });
  },

  read: (userid) => {
    return helper.connectToDatabase()
      .then((dbconn) => dbconn.collection(collectionName))
      .then((collection) => collection.findOne({
        _id: userid
      }));
  },

  update: (user) => {
    return helper.connectToDatabase()
      .then((dbconn) => dbconn.collection(collectionName))
      .then((collection) => {
        let isValid = false;
        try {
          isValid = userModel(user);
          if (!isValid) {
            return userModel.errors;
          }
          return collection.replaceOne({
            _id: user._id
          }, user);
        } catch (e) {
          console.log('user validation failed', e);
          throw e;
        }
      });
  },

  delete: (userid) => {
    return helper.connectToDatabase()
      .then((dbconn) => dbconn.collection(collectionName))
      .then((collection) => collection.remove({
        _id: userid
      }));
  },

  find: (query) => {
    return helper.connectToDatabase()
      .then((dbconn) => dbconn.collection(collectionName))
      .then((collection) => collection.find(query));
  },

  partlyUpdate: (findQuery, updateQuery, params = undefined) => {
    return helper.connectToDatabase()
      .then((dbconn) => dbconn.collection(collectionName))
      .then((collection) => collection.update(findQuery, updateQuery, params));
  }
};
