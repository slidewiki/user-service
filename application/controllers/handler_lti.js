'use strict';

const boom = require('boom'), //Boom gives us some predefined http codes and proper responses
  co = require('../common'),
  userCtrl = require('../database/user'),
  ltiCtrl = require('../database/lti'),
  config = require('../configuration'),
  jwt = require('./jwt'),
  util = require('./util'),
  lti = require('ims-lti'),
  handler = require('./handler');

module.exports = {

handleLTI: (req, res) => {
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
              // We login instead of register
              //TODO: Add a consistent means of generating username
              //depending on application, user, etc.
              let query = {
                username: req.payload.ext_user_username
              };
              return handler.getLoginUser(query, res);
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
