'use strict';

const api = require('./api.js'),
  handler = require('../controllers/handler.js');

console.log('Updating Queue');

return handler.getReviewableUsers(null, (array) => {
  if (array.length < 1) {
    console.log('No reviewable users available. Stoping now');
    exit();
  }

  let reviewableUserObjects = array.reduce((arr, curr) => {
    let o = api.getEmptyElement();
    o.userid = curr.userid;
    o.username = curr.username;
    o.decks = curr.decks;

    arr.push(o);
    return arr;
  }, []);

  return api.getAll()
    .then((array2) => {
      console.log(reviewableUserObjects.length, 'reviewable users versus already in queue:', array2.length);

      //filter in a way that just the new reviewable users are there
      let newReviewableUserObjects = reviewableUserObjects.filter((o) => {
        return array2.findIndex((x) => {
          return x.userid === o.userid;
        }) === -1;
      });

      if (newReviewableUserObjects.length < 1) {
        console.log('No new reviewable users to add to the queue. Stoping now');
        exit();
      }

      return api.add(newReviewableUserObjects)
        .then((success) => {
          console.log('Adding them to queue was successfully:', success);
          exit();
        });
    });
});

function exit() {
  process.exit(0);
  return true;
}
