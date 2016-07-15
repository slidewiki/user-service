'use strict';

const helper = require('./helper'),
    userModel = require('../models/user.js'),
    collectionName = 'users';

module.exports = {
    create: (user) => {
        return helper.connectToDatabase()
            .then((dbconn) => dbconn.collection(collectionName))
            .then((collection) => {
                let isValid = false;
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
    }
};
