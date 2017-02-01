'use strict';

const helper = require('./helper'),
  collectionName = 'oauthprovideruserdata',
  millisNeededForTimeout = 2*86400*1000;  //2 days

console.log(((new Date()).toISOString()) + ': Now starting cleanup of provider collection ...');

return helper.connectToDatabase()
  .then((dbconn) => dbconn.collection(collectionName))
  .then((collection) => collection.deleteMany({
    'token_creation': {
      $lt: (new Date((new Date()).getTime() - millisNeededForTimeout)).toISOString()
    }
  }))
  .then((result) => {
    console.log(((new Date()).toISOString()) + ': ' + collectionName + ' collection cleaned! Deleted ' + result.deletedCount + ' documents');
    process.exit();
    return true;
  })
  .catch((error) => {
    console.log(((new Date()).toISOString()) + ': ' + 'Error', error);
    process.exit();
    return true;
  });
