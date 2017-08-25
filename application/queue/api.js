'use strict';

const helper = require('../database/helper'),
  collectionName = 'queue';

module.exports = {
  add: (data) => {
    if (Array.isArray(data)) {
      return helper.connectToDatabase()
        .then((db) => db.collection(collectionName))
        .then((collection) => collection.insertMany(data))  //TODO perhaps better inserting them one by one
        .then((result) => {
          console.log(result.insertedCount, 'new elements in queue, we needed', data.length);
          return result.insertedCount === data.length;
        });
    }
    else {
      return helper.connectToDatabase()
        .then((db) => db.collection(collectionName))
        .then((collection) => collection.insertOne(data))
        .then((result) => {
          return result.insertedCount === 1;
        });
    }
  },
  get: () => {
    return helper.connectToDatabase()
      .then((db) => db.collection(collectionName))
      .then((collection) => collection.findAndModify({query:{}, sort: {i: -1}, remove: true}))
      .then((result) => {
        console.log('Got element from FIFO:', result);
        return result ? result.value : undefined;
      });
  },
  init: () => {
    return cleanCollection();
  },
  getAll: () => {
    return helper.connectToDatabase()
      .then((db) => db.collection(collectionName))
      .then((collection) => collection.find())
      .then((cursor) => cursor.toArray());
  },
  getAllAndDrop: () => {
    return helper.connectToDatabase()
      .then((db) => db.collection(collectionName))
      .then((collection) => collection.find())
      .then((cursor) => cursor.toArray())
      .then((array) => {
        if (array.length < 1)
          return [];

        return cleanCollection()
          .then(() => {
            return array;
          });
      });
  },
  getEmptyElement: () => {
    return {
      userid: 0,
      username: '',
      decks: 0
    };
  }
};

function cleanCollection() {
  return helper.connectToDatabase()
    .then((db) => db.collection(collectionName))
    .then((collection) => collection.drop())
    .then(() => {
      console.log('Collection queue is now empty and ready to use');
      return;
    });
}
