'use strict';

const helper = require('./helper'),
  ltiKey = require('../models/lti.js'),
  collectionName = 'ltikeys';


let self = module.exports = {
  create: (lti) => {
    return helper.connectToDatabase()
      .then((dbconn) => helper.getNextIncrementationValueForCollection(dbconn, collectionName))
      .then((newId) => {
        // console.log('newId', newId);
        return helper.connectToDatabase() //db connection have to be accessed again in order to work with more than one collection
          .then((db2) => db2.collection(collectionName))
          .then((collection) => {
            let isValid = false;
            lti._id = newId;
            try {
              isValid = ltiKey(lti);
              if (!isValid) {
                return ltiKey.errors;
              }
              return collection.insertOne(lti);
            } catch (e) {
              console.log('user validation failed', e);
              throw e;
            }
          }); //id is created and concatinated automatically
      });
  },

  read: (key) => {
    return helper.connectToDatabase()
      .then((dbconn) => dbconn.collection(collectionName))
      .then((collection) => collection.findOne({
        key: key
      }));
  },


  delete: (userid) => {
    return helper.connectToDatabase()
      .then((dbconn) => dbconn.collection(collectionName))
      .then((collection) => collection.remove({
        _id: userid //TODO tis is just wrong - crete inserts an increment and not a userid
      }));
  },

};
