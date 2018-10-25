'use strict';

const boom = require('boom'), //Boom gives us some predefined http codes and proper responses
  co = require('../common'),
  userCtrl = require('../database/user'),
  userltiCtrl = require('../database/userlti'),
  jwt = require('./jwt'),
  util = require('./util'),
  lti = require('ims-lti'),
  LTI_ID = require('../configuration.js').LTI_ID;

const PLATFORM_LTI_URL = require('../configs/microservices').platform.uri+ '/ltiLogin';

module.exports = {

  handleLTI: (req, res) => {

    let isValid = false;

    return userltiCtrl.readAllLTIs()
      .then((ltiArray) => {
        for(let i=0; i<ltiArray.length; i++){
          let ltiObj = ltiArray[i];
          let ltiProvider = new lti.Provider(ltiObj.key, ltiObj.secret);
          ltiProvider.valid_request(req, (err, isValid) => {
            if(err){
              console.log('There was an error in the LTI request', err);
            }
            else {
              console.log('There is the valid LTI request. i='+i);
              proceedLTI(req, res, ltiObj);
            }
          });
        } //end for
      }).catch((error) => {
        console.log('userltiCtrl.readAllLTIs failed:', error);
        res(boom.badImplementation('Error', error));
      });
  },

};



function proceedLTI(req, res, ltiObj){
  let email = 'lti'+ltiObj._id+'.user'+(ltiObj.members.length+1)+'@slidewiki.org';
  let user = getUser(req, email);

  return util.isLTIIdentityAssigned(user.username)
    .then((result) => {
      if (result.assigned === false) {
        // If the user doesn't exist, create a new user
        return userCtrl.create(user)
          .then((result) => {
            //console.log('result='+simpleStringify(result));
            if (result[0] !== undefined && result[0] !== null) {
              //Error
              console.log('ajv error', result, co.parseAjvValidationErrors(result));
              return res(boom.badData('registration failed because data is wrong: ', co.parseAjvValidationErrors(result)));
            }
            if (result.insertedCount === 1) {
              //success
              console.log('new user created. successful, result.insertedId='+result.insertedId);
              let newUserId = result.insertedId;
              let data = {
                userid: result.insertedId,
                username: user.username,
                jwt: jwt.createLTIToken({
                  userid: result.insertedId,
                  username: user.username
                })
              };

              //Add new user to the LTI group
              let member = {
                userid: newUserId,
                joined: (new Date()).toISOString()
              };
              ltiObj.members.push(member);

              return userltiCtrl.update(ltiObj)
                .then((result) => {

                  //success
                  return res()
                    .redirect(PLATFORM_LTI_URL + '?data=' + encodeURIComponent(JSON.stringify(data)))
                    .temporary(true);

                }).catch((error) => {
                  console.log('userltiCtrl.update(lti) failed:', error);
                  res(boom.badImplementation('Error', error));
                });

            }
            res(boom.badImplementation());
          }).catch((error) => {
            console.log('userCtrl.create(user) failed:', error);
            res(boom.badImplementation('Error', error));
          });


      } else {
        // If the user is already registered, sign in
        console.log('already registered. signed in. result='+simpleStringify(result));
        console.log('PLATFORM_LTI_URL ='+PLATFORM_LTI_URL);
        console.log('result.userid ='+result.userid);
        let id = result.userid;
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

    }).catch((error) => {
      console.log('Error - util.isLTIIdentityAssigned( '+user.username+') failed:', error);
      res(boom.badImplementation('Error', error));
    });

}

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


function getUser(req, email){
  console.log('req.payload.ext_user_username='+req.payload.ext_user_username);
  let username = util.parseAPIParameter(req.payload.ext_user_username).replace(/\s/g,'')+LTI_ID;
  return {
    username: username,
    email: email,
    frontendLanguage: 'en',
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
