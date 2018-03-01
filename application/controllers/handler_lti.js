'use strict';

const boom = require('boom'), //Boom gives us some predefined http codes and proper responses
  co = require('../common'),
  userCtrl = require('../database/user'),
  //ltiCtrl = require('../database/lti'),
  //config = require('../configuration'),
  jwt = require('./jwt'),
  util = require('./util'),
  lti = require('ims-lti'),
  //handler = require('./handler'),
  Microservices = require('../configs/microservices.js');

const user_CookieName = 'user_json_storage';
const PROVIDERS = ['github', 'google', 'facebook'],
  PLATFORM_SOCIAL_URL = require('../configs/microservices').platform.uri + '/socialLogin',
  PLATFORM_LTI_URL = require('../configs/microservices').platform.uri+ '/ltiLogin',
  PLATFORM_INFORMATION_URL = require('../configs/microservices').platform.uri + '';

module.exports = {

  handleLTI: (req, res) => {
    //console.log('handleLTI-New');
    //console.log('req='+JSON.stringify(req.query));
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

        console.log('Registration with LTI: ', user.username, user.email);
        //check if username already exists
        return util.isIdentityAssigned(user.email, user.username)
          .then((result) => {

            if (result.assigned === false) {
              // If the user doesn't exist, create a new user
              return userCtrl.create(user)
                .then((result) => {

                  console.log('result='+simpleStringify(result));
                  if (result[0] !== undefined && result[0] !== null) {
                    //Error
                    console.log('ajv error', result, co.parseAjvValidationErrors(result));
                    return res(boom.badData('registration failed because data is wrong: ', co.parseAjvValidationErrors(result)));
                  }

                  if (result.insertedCount === 1) {
                    //success
                    console.log('new user created. successful, result.insertedId='+result.insertedId);
                    let data = {
                      userid: result.insertedId,
                      username: user.username,
                      jwt: jwt.createLTIToken({
                        userid: result.insertedId,
                        username: user.username
                      })
                    };

                    //success
                    return res()
                      .redirect(PLATFORM_LTI_URL + '?data=' + encodeURIComponent(JSON.stringify(data)))
                      .temporary(true);

                  }

                  res(boom.badImplementation());
                });


            } else {

              /*
                  If the user is already registered, sign in
              */
              console.log('already registered. signed in. result='+simpleStringify(result));
              let id = result.userid;
              //id='1';
              let data = {
                userid: id,
                username: user.username,
                jwt: jwt.createLTIToken({
                  userid: id,
                  username: user.username
                })
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


};

function simpleStringify (object){
  let simpleObject = {};
  for (let prop in object ){
    if (!object.hasOwnProperty(prop)){
      continue;
    }
    if (typeof(object[prop]) == 'object'){
      continue;
    }
    if (typeof(object[prop]) == 'function'){
      continue;
    }
    simpleObject[prop] = object[prop];
  }
  return JSON.stringify(simpleObject); // returns cleaned up JSON
}


function getUser(req){
  //let username = util.parseAPIParameter(req.payload.ext_user_username).replace(/\s/g,'') || document.username.replace(/\s/g,'');
  let username = util.parseAPIParameter(req.payload.ext_user_username).replace(/\s/g,'');
  let email = util.parseAPIParameter(req.payload.lis_person_contact_email_primary).toLowerCase();

  return {
    //username:         util.parseAPIParameter(req.payload.ext_user_username).replace(/\s/g,'') || document.username.replace(/\s/g,''),
    //email:            util.parseAPIParameter(req.payload.lis_person_contact_email_primary).toLowerCase(),
    username: username,
    email: email,
    frontendLanguage: 'en',
    // spokenLanguages: [util.parseAPIParameter(req.payload.language)],
    //country:          util.parseAPIParameter(req.payload.launch_presentation_locale) || document.location || '',
    country:          util.parseAPIParameter(req.payload.launch_presentation_locale),
    picture:          '',
    description:      '',
    organization:     '',
    registered:       (new Date()).toISOString(),
    forename:         util.parseAPIParameter(req.payload.lis_person_name_given) || '',
    surname:          util.parseAPIParameter(req.payload.lis_person_name_family) || '',
    authorised: true
  };
}
