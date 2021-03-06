'use strict';

const userCtrl = require('../database/user'),
  userltiCtrl = require('../database/userlti'),
  SMTPConnection = require('smtp-connection'),
  config = require('../configuration'),
  Joi = require('joi');

module.exports = {
  isJWTValidForTheGivenUserId: (req) => {
    let jwt_userid = '';
    try {
      jwt_userid = req.auth.credentials.userid;
    } catch (e) {/**/}
    //console.log(decodeURI(req.params.id), 'vs', jwt_data);
    if (decodeURI(req.params.id).toString() !== jwt_userid.toString()) {
      return false;
    }
    return true;
  },

  isIdentityAssigned: (email, username) => {
    let myPromise = new Promise((resolve, reject) => {
      // check for static users!!
      let staticUser = userCtrl.findStaticUserByName(username);
      if (staticUser) {
        return resolve({
          assigned: true,
          username: true,
          email: false,
        });
      }

      return userCtrl.find({
        $or: [
          {
            username: new RegExp('^' + username + '$', 'i')
          },
          {
            email: email
          }
        ]
      })
        .then((cursor) => cursor.project({email: 1, username: 1}))
        .then((cursor2) => cursor2.toArray())
        .then((array) => {
          console.log('isIdentityAssigned: cursor.array.length:', array.length);

          if (array.length > 0) {
            //console.log('array='+JSON.stringify(array)); // returns cleaned up JSON
            //console.log('array.id='+array[0]);

            let userId = -1;
            /*
              Retrieve value of user id from the array
            */
            for(let field1 in array){
              if (array.hasOwnProperty(field1)) {
                let key1 = field1;
                let value1 = array[field1];

                for(let field2 in value1){
                  if (value1.hasOwnProperty(field2)) {
                    let key2 = field2;
                    let value2 = value1[field2];
                    console.log('key2='+key2+', value2='+value2);

                    if(key2 === '_id'){
                      userId = value2;
                      break;
                    }
                  }
                }
                //console.log('key='+key1+', value='+value1);
              }
            }
            console.log('userId='+userId);


            const isEMailAssigned = !(array.reduce((prev, curr) => {
              const sameEMail = curr.email === email;
              return prev && !sameEMail;
            }, true));
            const isUsernameAssigned = !(array.reduce((prev, curr) => {
              const sameUsername = curr.username.toLowerCase() === username.toLowerCase();
              return prev && !sameUsername;
            }, true));

            resolve({
              assigned: isEMailAssigned || isUsernameAssigned,
              username: isUsernameAssigned,
              email: isEMailAssigned,
              userid: userId
            });
          } else {
            resolve({assigned: false});
          }
        })
        .catch((error) => {
          reject(error);
        });
    });
    return myPromise;
  },


  isLTIIdentityAssigned: (username) => {
    let myPromise = new Promise((resolve, reject) => {
      // check for static users!!
      let staticUser = userCtrl.findStaticUserByName(username);
      if (staticUser) {
        return resolve({
          assigned: true,
          username: true,
          email: false,
        });
      }

      return userCtrl.find({
        $or: [
          {
            username: new RegExp('^' + username + '$', 'i')
          }
        ]
      })
        .then((cursor) => cursor.project({email: 1, username: 1}))
        .then((cursor2) => cursor2.toArray())
        .then((array) => {
          console.log('util.isLTIIdentityAssigned: cursor.array.length:', array.length);
          if (array.length > 0) {

            let userId = -1;
            /*
              Retrieve value of user id from the array
            */
            for(let field1 in array){
              if (array.hasOwnProperty(field1)) {
                let key1 = field1;
                let value1 = array[field1];

                for(let field2 in value1){
                  if (value1.hasOwnProperty(field2)) {
                    let key2 = field2;
                    let value2 = value1[field2];
                    //console.log('key2='+key2+', value2='+value2);

                    if(key2 === '_id'){
                      userId = value2;
                      break;
                    }
                  }
                }
              }
            }

            const isUsernameAssigned = !(array.reduce((prev, curr) => {
              const sameUsername = curr.username.toLowerCase() === username.toLowerCase();
              return prev && !sameUsername;
            }, true));

            resolve({
              assigned: isUsernameAssigned,
              username: isUsernameAssigned,
              userid: userId
            });
          } else {
            resolve({assigned: false});
          }
        })
        .catch((error) => {
          reject(error);
        });
    });
    return myPromise;
  },

  parseAPIParameter: (parameter) => {
    if (parameter === undefined || parameter === null || parameter.toString().replace(' ', '') === '')
      return '';

    return decodeURI(parameter);
  },

  parseStringToInteger: (string) => {
    const integerSchema = Joi.number().integer();
    const validationResult = integerSchema.validate(string);
    if (validationResult.error === null) {
      return validationResult.value;
    }
    return undefined;
  },

  sendEMail: (email, title, text) => {
    console.log('trying to send an email:', email, text);

    return new Promise((resolve, reject) => {
      if (!config.SMTP.enabled) {
        return resolve({email: email, message:  'SMTP is disabled by deployment.'});
      }

      //send email before changing data on MongoDB
      let connection;
      try {
        connection = new SMTPConnection({
          host: config.SMTP.host,
          port: config.SMTP.port,
          name: config.SMTP.clientName,
          connectionTimeout: 4000,
          opportunisticTLS: true,
          tls: {
            rejectUnauthorized: false
          }
        });
      }
      catch (e) {
        console.log(e);
        return reject('Wrong SMTP configuration');
      }

      connection.on('error', (err) => {
        console.log('ERROR on SMTP Client:', err);
        if (process.env.NODE_ENV === 'test')
          return resolve({email: email, message:  'dummy'});//DEBUG
        return reject(err);
      });

      connection.connect((result) => {
        //Result of connected event
        console.log('Connection established with result', result, 'and connection details (options, secureConnection, alreadySecured, authenticated)', connection.options, connection.secureConnection, connection.alreadySecured, connection.authenticated);

        connection.send({
          from: config.SMTP.from,
          to: email
        },
        'From: <' + config.SMTP.from + '>\r\n' + 'To: <' + email + '>\r\n' + 'Subject: ' + title + '\r\nDate: ' + (new Date()).toGMTString() + '\r\n\r\n' + text,
        (err, info) => {
          console.log('tried to send the email:', err, info);

          try {
            connection.quit();
          }
          catch (e) {
            console.log('SMTP connection quit failed:', e);
          }

          if (err !== null) {
            return reject(err);
          }

          //handle info object
          if (info.rejected.length > 0) {
            return reject('Email was rejected');
          }

          resolve({email: email, message: info.response});
        });
      });
    });
  }
};
