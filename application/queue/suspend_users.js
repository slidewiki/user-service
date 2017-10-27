'use strict';

console.log('This script will read userids from the given file and suspend them one after another.');

const readline = require('readline'),
  fs = require('fs'),
  config = require('../configuration'),
  userCtrl = require('../database/user'),
  async = require('async'),
  request = require('request'),
  helper = require('../database/helper');

let deckidsToUserids = {};

if (process.argv[3] === undefined) {
  console.log('Please provide a JWT!');
  return;
}

const rl = readline.createInterface({
  input: fs.createReadStream(process.argv[2])
});

console.log('First the userids are read.');
let linePromises = [];

rl.on('line', function (line) {
  console.log('Got userid:', line);

  let userid = parseInt(line);

  if (!Number.isInteger(userid)) {
    console.log('This is not an interger - skipping');
    return;
  }

  if (deckidsToUserids[userid] !== undefined) {
    console.log('duplication of userid');
    return;
  }

  deckidsToUserids[userid] = [];

  let linePromise = new Promise((resolve, reject) => {
    let query = {
      _id: userid,
      suspended: {
        $not: {
          $eq: true
        }
      }
    };
    let update = {
      $set: {
        reviewed: true,
        suspended: true
      }
    };
    userCtrl.partlyUpdate(query, update)
      .then((result) => {
        if (result.result.ok === 1 && result.result.n === 1) {
          //found user and got updated

          //now archive all the decks of the user
          const options = {
            url: require('../configs/microservices').deck.uri + '/decks',
            method: 'GET',
            qs: {
              user: userid,
              // only get the root decks, subdecks cannot be directly archived
              rootsOnly: true,
              // only return the _id attribute,
              idOnly: true,
            },
            json: true
          };

          function callback(error, response, body) {
            console.log('userid '+userid+', root decks: ', (response) ? response.statusCode : undefined, error, body);

            if (!error && (response.statusCode === 200)) {
              //now archive all decks (one request per deck)
              let promises = body.reduce((arr, curr) => {
                arr.push(archiveDeck(curr._id, process.argv[3], 'spam'));
                return arr;
              }, []);

              async.eachOfSeries(promises, (promise, key, callback2) => {
                promise.then((deckid) => {
                  deckidsToUserids[userid].push(deckid);
                  callback2();
                })
                .catch((error) => {
                  console.log('Error:', error);
                  callback2();
                });
              },  (error) => {
                if (error)
                  console.log('async Error:', error);
                resolve();
              });
            } else {
              console.log('response Error', (response) ? response.statusCode : undefined, error, body);
              resolve();
            }
          }

          if (process.env.NODE_ENV === 'test') {
            callback(null, {statusCode: 200}, []);
          }
          else
            request(options, callback);
        }
        else {
          console.log('Problem with user query:', query, result.result);
          resolve();
          return;
        }
      })
      .catch((error) => {
        console.log('Error', error);
        resolve();
      });
  });
  linePromises.push(linePromise);
});

function archiveDeck(deckid, authToken, reason='spam', comment) {
  let myPromise = new Promise((resolve, reject) => {
    const headers = {};
    headers[config.JWT.HEADER] = authToken;

    const options = {
      url: require('../configs/microservices').deck.uri + '/decktree/'+deckid+'/archive',
      method: 'POST',
      json: true,
      body: {
        secret: process.env.SECRET_REVIEW_KEY,
        reason: reason,
        comment: comment,
      },
      headers: headers,
    };

    function callback(error, response, body) {
      console.log('archiveDeck '+deckid+': ', (response) ? response.statusCode : undefined, error, body);

      if (!error && (response.statusCode === 200)) {
        resolve(deckid);
      } else {
        return reject(error);
      }
    }

    if (process.env.NODE_ENV === 'test') {
      callback(null, {statusCode: 200}, null);
    }
    else
      request(options, callback);
  });
  return myPromise;
}

rl.on('close', function () {
  console.log('Finished reading userids.');
  console.log('Count of correct userids read: ', Object.keys(deckidsToUserids).length);

  console.log("\nNow suspending users and decks");
  async.eachOfSeries(linePromises, (promise, key, callback2) => {
    promise.then(() => {
      callback2();
    })
    .catch((error) => {
      console.log('linePromise Error:', error);
      callback2();
    });
  },  (error) => {
    if (error)
      console.log('async Error:', error);
    let message = '';
    for (let k in deckidsToUserids) {
      let deckids = deckidsToUserids[k].reduce((s, c) => {return s + ', ' + c;}, '');
      message += k + ' [' + deckids + "], \n";
    }

    console.log("\nHere are all the userids with their suspended decks:\n", message);

    console.log("\n\nAt the end, suspended users have to be removed from the queue if they are already there.");
    let query = {$or: Object.keys(deckidsToUserids).reduce((arr, curr) => {
      arr.push({userid: parseInt(curr)});
      return arr;
    }, [])};
    console.log(query);
    helper.connectToDatabase()
      .then((dbconn) => dbconn.collection('reviewable_users'))
      .then((collection) => collection.remove(query))
      .then((result) => {
        console.log('deleted from queue', result.result);
        process.exit(0);
      })
      .catch((err) => {
        console.log('Error', err);
        process.exit(0);
      });
  });
});
