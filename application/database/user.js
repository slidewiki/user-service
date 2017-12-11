'use strict';

const helper = require('./helper'),
  userModel = require('../models/user.js'),
  collectionName = 'users',
  collectionNameTemp = 'temp_users';

// hardcoded (static) users
// the attributes included are only the public user attributes needed
const staticUsers = [
  {
    _id: -1,
    username: 'system',
    organization: '',
    picture: '',
    description: 'This is a reserved system account',
    country: '',
  },
];

let self = module.exports = {
  create: (user, temp = false) => {
    let name = (temp) ? collectionNameTemp : collectionName;
    return helper.connectToDatabase()
      .then((dbconn) => helper.getNextIncrementationValueForCollection(dbconn, name))
      .then((newId) => {
        // console.log('newId', newId);
        return helper.connectToDatabase() //db connection have to be accessed again in order to work with more than one collection
          .then((db2) => db2.collection(name))
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

  delete: (userid, temp = false) => {
    let name = (temp) ? collectionNameTemp : collectionName;
    return helper.connectToDatabase()
      .then((dbconn) => dbconn.collection(name))
      .then((collection) => collection.remove({
        _id: userid
      }));
  },

  find: (query, temp = false) => {
    let name = (temp) ? collectionNameTemp : collectionName;
    return helper.connectToDatabase()
      .then((dbconn) => dbconn.collection(name))
      .then((collection) => collection.find(query));
  },

  partlyUpdate: (findQuery, updateQuery, params = undefined) => {
    return helper.connectToDatabase()
      .then((dbconn) => dbconn.collection(collectionName))
      .then((collection) => collection.update(findQuery, updateQuery, params));
  },

  findStaticUserById: function(userid) {
    // return nothing if non-static or unknown
    if (userid > 0) return null;
    // maybe null
    return staticUsers.find((u) => u._id === userid);
  },

  findStaticUsersByIds: function(userids) {
    if (!userids) return [];
    return staticUsers.filter((u) => userids.includes(u._id));
  },

  // check username against static users array
  findStaticUserByName: function(username) {
    if (!username) return null;
    // maybe null
    return staticUsers.find((u) => u.username === username.toLowerCase());
  },

  findStaticUser: function(query) {
    return self.findStaticUserByName(query.username) || self.findStaticUserById(query._id);
  },

};
