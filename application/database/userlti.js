'use strict';

const helper = require('./helper'),
  userltiModel = require('../models/userlti.js'),
  collectionName = 'userltis';

module.exports = {
  create: (userlti) => {
    return helper.connectToDatabase()
      .then((dbconn) => helper.getNextIncrementationValueForCollection(dbconn, collectionName))
      .then((newId) => {
        // console.log('newId', newId);
        return helper.connectToDatabase() //db connection have to be accessed again in order to work with more than one collection
          .then((db2) => db2.collection(collectionName))
          .then((collection) => {
            let isValid = false;
            userlti._id = newId;
            try {
              isValid = userltiModel(userlti);
              if (!isValid) {
                return userltiModel.errors;
              }
              return collection.insertOne(userlti);
            } catch (e) {
              console.log('userlti validation failed', e);
              throw e;
            }
          }); //id is created and concatinated automatically
      });
  },

  read: (id) => {
    return helper.connectToDatabase()
      .then((dbconn) => dbconn.collection(collectionName))
      .then((collection) => collection.findOne({
        _id: id
      }));
  },


  readLTI: (ltiKey, ltiSecret) => {
    return helper.connectToDatabase()
      .then((dbconn) => dbconn.collection(collectionName))
      .then((collection) => collection.findOne({
        key: ltiKey,
        secret: ltiSecret
      }));
  },


  readAllLTIs: () => {
    console.log('database.userlti.readLTIs');
    return helper.connectToDatabase()
      .then((dbconn) => dbconn.collection(collectionName))
      .then((collection) => collection.find())
      .then((cursor) => cursor.toArray());
  },

  readLTIsOfUser: (userid) => {
    return helper.connectToDatabase()
      .then((dbconn) => dbconn.collection(collectionName))
      .then((collection) => collection.find({
        $or: [
          {
            'creator.userid': userid
          },
          {
            'creator': userid
          },
          {
            'members.userid': userid
          }
        ]
      }))
      .then((cursor) => cursor.toArray());
  },

  update: (userlti) => {
    return helper.connectToDatabase()
      .then((dbconn) => dbconn.collection(collectionName))
      .then((collection) => {
        let isValid = false;
        try {
          isValid = userltiModel(userlti);
          if (!isValid) {
            return userltiModel.errors;
          }
          return collection.replaceOne({
            _id: userlti._id
          }, userlti);
        } catch (e) {
          console.log('userlti validation failed', e);
          throw e;
        }
      });
  },

  delete: (id) => {
    return helper.connectToDatabase()
      .then((dbconn) => dbconn.collection(collectionName))
      .then((collection) => collection.remove({
        _id: id
      }));
  },

  find: (query) => {
    return helper.connectToDatabase()
      .then((dbconn) => dbconn.collection(collectionName))
      .then((collection) => collection.find(query));
  },

  partlyUpdate: (findQuery, updateQuery) => {
    return helper.connectToDatabase()
      .then((dbconn) => dbconn.collection(collectionName))
      .then((collection) => collection.update(findQuery, updateQuery));
  }
};
