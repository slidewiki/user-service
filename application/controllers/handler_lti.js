'use strict';

const boom = require('boom'), //Boom gives us some predefined http codes and proper responses
  co = require('../common'),
  userCtrl = require('../database/user'),
  ltiCtrl = require('../database/lti'),
  config = require('../configuration'),
  jwt = require('./jwt'),
  util = require('./util'),
  lti = require('ims-lti'),
  handler = require('./handler'),
  express = require('express'),
  cookieParser = require('cookie-parser'),
  Microservices = require('../configs/microservices.js');

const user_CookieName = 'user_json_storage';
const PROVIDERS = ['github', 'google', 'facebook'],
  PLATFORM_SOCIAL_URL = require('../configs/microservices').platform.uri + '/socialLogin',
  PLATFORM_LTI_URL = require('../configs/microservices').platform.uri+ '/ltiLogin',
  PLATFORM_INFORMATION_URL = require('../configs/microservices').platform.uri + '';

module.exports = {

handleLTI: (req, res) => {
    console.log('handleLTI-New');
    console.log('req='+JSON.stringify(req.query));
    // Validate LTI request
    let ltiKeySecret = {
      '_id': 1234,
      'key': 'CHANGEME',
      'secret': 'CHANGEME'
    };

    //TODO: Accept different types of signatures
    let ltiProvider = new lti.Provider(ltiKeySecret.key, ltiKeySecret.secret);
    ltiProvider.valid_request(req, function(err, isValid){
        if(err){
            console.log('There was an error in the LTI request', err);
            res(boom.badImplementation());
        }
        else{
          let user = getUser(req);
          //check if username already exists
          return util.isIdentityAssigned(user.email, user.username)
            .then((result) => {

              //res.redirect('http://localhost:3000');
              if (result.assigned === false) {
                    // If the user doesn't exist, we must create them

                    console.log('Registration with LTI: ', user.username, user.email);

                    return userCtrl.create(user)
                      .then((result) => {

                        if (result[0] !== undefined && result[0] !== null) {
                          //Error
                          console.log('ajv error', result, co.parseAjvValidationErrors(result));
                          return res(boom.badData('registration failed because data is wrong: ', co.parseAjvValidationErrors(result)));
                        }

                        if (result.insertedCount === 1) {
                          //success
                          console.log('succesful');

                            let data = {
                              userid: result.insertedId,
                              username: user.username,
                              email: 'umer_rashid@yahoo.com',
                              access_token: 'dummy',
                              expires_in: 0
                            };

                          //success
                          return res()
                            .redirect(PLATFORM_LTI_URL + '?data=' + encodeURIComponent(JSON.stringify(data)))
                            .temporary(true);


                        }

                        res(boom.badImplementation());
                      })


              } else {
                console.log('register');
                // We login instead of register
                //TODO: Add a consistent means of generating username
                //depending on application, user, etc.
                let query = {
                  username: req.payload.ext_user_username
                };


              let data = {
                userid: result.insertedId,
                username: user.username,
                access_token: 'dummy',
                email: 'umer_rashid@yahoo.com',
                expires_in: 0

              };

            //success
            return res()
              .redirect(PLATFORM_LTI_URL + '?data=' + encodeURIComponent(JSON.stringify(data)))
              .temporary(true);

              }

            })
            .catch((error) => {
              console.log('Error - util.isIdentityAssigned('+user.email+', '+user.username+') failed:', error);
              res(boom.badImplementation('Error', error));
            });


        }
    });

},

handleLTI2: (req, res) => {
  console.log('handleLTI');
  //TODO: Implement as promise
  // let ltiKeySecret = ltiCtrl.read(util.parseAPIParameter(req.payload.oauth_consumer_key))
  //   .then(() => {
  //
  //   });

  // Validate LTI request
  let ltiKeySecret = {
    '_id': 1234,
    'key': 'CHANGEME',
    'secret': 'CHANGEME'
  };



  //TODO: Accept different types of signatures
  let ltiProvider = new lti.Provider(ltiKeySecret.key, ltiKeySecret.secret);
  ltiProvider.valid_request(req, function(err, isValid){
      if(err){
          console.log('There was an error in the LTI request', err);
          res(boom.badImplementation());
      }
      else{
        let user = getUser(req);
        //check if username already exists
        return util.isIdentityAssigned(user.email, user.username)
          .then((result) => {

            //res.redirect('http://localhost:3000');
            if (result.assigned === false) {
                  // If the user doesn't exist, we must create them

                  console.log('Registration with LTI: ', user.username, user.email);

                  return userCtrl.create(user)
                    .then((result) => {

                      if (result[0] !== undefined && result[0] !== null) {
                        //Error
                        console.log('ajv error', result, co.parseAjvValidationErrors(result));
                        return res(boom.badData('registration failed because data is wrong: ', co.parseAjvValidationErrors(result)));
                      }

                      if (result.insertedCount === 1) {
                        //success
                        console.log('succesful');
                        return res({
                          userid: result.insertedId,
                          username: user.username,
                          access_token: 'dummy',
                          expires_in: 0
                        })
                        .header(config.JWT.HEADER, jwt.createToken({
                          userid: result.insertedId,
                          username: user.username
                        }));
                      }

                      res(boom.badImplementation());
                    })


            } else {
              console.log('register');
              // We login instead of register
              //TODO: Add a consistent means of generating username
              //depending on application, user, etc.
              let query = {
                username: req.payload.ext_user_username
              };



              let session = req.state.user_json_storage;
                if (!session) {
                    session = {
                      userid: result.insertedId,
                      username: user.username,
                      jwt: jwt.createToken({
                        userid: result.insertedId,
                        username: user.username
                      })
                    };
                }

              //app.use(express.cookieParser());

              let cookie_string = 'user_json_storage=' + JSON.stringify(session) +
                '; Secure; HttpOnly';

              //res('Success');
              //reply('Hello').state('data', { firstVisit: false });
              //res.state('user_json_storage', session);
              //res.state('user_json_storage', session);

              var app = express();
              app.use(cookieParser());

            //  res.cookie('user_json_storage', JSON.stringify(session), { maxAge: 900000, httpOnly: true });
              //res.cookie('user_json_storage', 'cookievalue', { maxAge: 900000, httpOnly: true });
              //res.state('user_json_storage', 'hello', { firstVisit: false });
              //res.state('data', session);
              //res.redirect(Microservices.platform.uri);

              //res.cookie('cookiename', 'cookievalue', { maxAge: 900000, httpOnly: true });
              //res.redirect('http://localhost:3000').state('user_json_storage', session);

              //res.end('Hello World\n');

            //  res.cookie('user_json_storage' ,JSON.stringify(session));
              res.redirect(Microservices.platform.uri);

              //res.redirect(Microservices.platform.uri).header('Set-Cookie', cookie_string).header(config.JWT.HEADER, session.jwt);//jwt.createToken({
              //    userid: result.insertedId,
              //    username: user.username
              //  }));//.state('user_json_storage', session);


              //res('Hello World').state('data', { firstVisit: false });

/*
              res({
                userid: result.insertedId,
                username: user.username,
                access_token: 'dummy',
                expires_in: 0
              }).state('data', 'test', { encoding: 'none' });
*/

    //          res.redirect('http://localhost:3000');
              //return res;
              //return res.redirect('http://localhost:3000');
              //res.redirect('http://localhost:3000');
              //return handler.getLoginUser(query, res);
            }

          })
          .catch((error) => {
            console.log('Error - util.isIdentityAssigned('+user.email+', '+user.username+') failed:', error);
            res(boom.badImplementation('Error', error));
          });


      }
  });
},

};

function getUser(req){
  return {
    username:         util.parseAPIParameter(req.payload.ext_user_username).replace(/\s/g,'') || document.username.replace(/\s/g,''),
    email:            util.parseAPIParameter(req.payload.lis_person_contact_email_primary).toLowerCase(),
    frontendLanguage: 'en',
    // spokenLanguages: [util.parseAPIParameter(req.payload.language)],
    country:          util.parseAPIParameter(req.payload.launch_presentation_locale) || document.location || '',

    picture:          '',
    description:      '',
    organization:     '',
    registered:       (new Date()).toISOString(),
    forename:         util.parseAPIParameter(req.payload.lis_person_name_given) || '',
    surname:          util.parseAPIParameter(req.payload.lis_person_name_family) || '',
    authorised: true
  };
}
