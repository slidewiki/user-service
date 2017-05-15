/*
This script updates the passwords of all users by hashing it (with the provided salt) - only execute this once, outherwise passwords are broken!
 */

'use strict';

const co = require('./common'),
  userDB = require('./database/user'),
  JSSHA = require('js-sha512'),
  async = require('async');

let salt = '';

console.log('\x1b[31m','This script updates the passwords of all users by hashing it (with the provided salt) - only execute this once, outherwise passwords are broken!','\x1b[0m');//strange stuff for red color

if(process.argv.length < 3 || process.argv.length > 3){
  console.log('To few (or many) arguments, please provide only a salt as an argument!');
  process.exit(1);
} else
  salt = process.argv[2];

userDB.find({})
.then((cursor) => {
  cursor.count().then((count) => console.log(count + ' users found, starting migration ...'));
  let q = async.queue((user, callback) => {
    let hashedPassword = JSSHA.sha512(user.password + salt);
    userDB.partlyUpdate({'_id': user._id}, {'$set': {'password': hashedPassword}}).then(() => {
      process.stdout.write('\rUpdated user ' + user._id + ' (out of order)');
      callback();
    });
  }, Infinity);

  cursor.forEach((user) => {
    if(!co.isEmpty(user)){
      q.push(user);
    }
  });
  q.drain = function() {
    if (cursor.isClosed()) {
      console.log('\n');
      console.log('All Users have been updated');
      process.exit(0);
    }
  };
});
