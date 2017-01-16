'use strict';

const helper = require('./helper'),
  usergroupModel = require('../models/usergroup.js'),
  collectionName = 'usergroups';

module.exports = {
  create: (usergroup) => {
    return helper.connectToDatabase()
      .then((dbconn) => helper.getNextIncrementationValueForCollection(dbconn, collectionName))
      .then((newId) => {
        // console.log('newId', newId);
        return helper.connectToDatabase() //db connection have to be accessed again in order to work with more than one collection
          .then((db2) => db2.collection(collectionName))
          .then((collection) => {
            let isValid = false;
            usergroup._id = newId;
            try {
              isValid = usergroupModel(usergroup);
              if (!isValid) {
                return usergroupModel.errors;
              }
              return collection.insertOne(usergroup);
            } catch (e) {
              console.log('usergroup validation failed', e);
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

  readGroupsOfUser: (userid) => {
    return helper.connectToDatabase()
      .then((dbconn) => dbconn.collection(collectionName))
      .then((collection) => collection.find({
        $or: [
          {
            'creator.userid': userid
          },
          {
            'members.userid': userid
          }
        ]
      }))
      .then((cursor) => cursor.toArray());
  },

  update: (usergroup) => {
    return helper.connectToDatabase()
      .then((dbconn) => dbconn.collection(collectionName))
      .then((collection) => {
        let isValid = false;
        try {
          isValid = usergroupModel(usergroup);
          if (!isValid) {
            return usergroupModel.errors;
          }
          return collection.replaceOne({
            _id: usergroup._id
          }, usergroup);
        } catch (e) {
          console.log('usergroup validation failed', e);
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

  findAndDelete: (id, userid) => {
    return helper.connectToDatabase()
      .then((dbconn) => dbconn.collection(collectionName))
      .then((collection) => collection.findOneAndDelete({
        _id: id,
        'creator.userid': userid
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
