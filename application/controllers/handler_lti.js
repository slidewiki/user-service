'use strict';

const boom = require('boom'), //Boom gives us some predefined http codes and proper responses
  co = require('../common'),
  userCtrl = require('../database/user'),
  userltiCtrl = require('../database/userlti'),
  //config = require('../configuration'),
  jwt = require('./jwt'),
  util = require('./util'),
  lti = require('ims-lti'),
  LTI_ID = require('../configuration.js').LTI_ID;

const PLATFORM_LTI_URL = require('../configs/microservices').platform.uri+ '/ltiLogin';

module.exports = {

  handleLTI: (req, res) => {

    let resource_id = req.params.resource_id;
    let isValid = false;

    return userltiCtrl.readAllLTIs()
      .then((ltiArray) => {
      //console.log("array.length"+ltiArray.length);
        let found = false;
        for(let i=0; i<ltiArray.length; i++){
          if(!found){
            let ltiObj = ltiArray[i];
            //console.log("lti.secret="+ltiObj.secret+ ", lti.key="+ltiObj.key);
            var ltiProvider = new lti.Provider(ltiObj.key, ltiObj.secret);
            ltiProvider.valid_request(req, function(err, isValid){
              if(err){
                console.log('There was an error in the LTI request', err);
              }
              else {
                console.log('There is the valid LTI request. i='+i);
                isValid = true;
                found = true;
                //console.log('isValid='+isValid);
                //console.log('lti.id='+ltiObj._id+', lti.members.length='+ltiObj.members.length);
                proceedLTI(req, res, ltiObj);
              }
            });
          }//end if(!found)
        } //end for
      }).catch((error) => {
        console.log('userltiCtrl.readAllLTIs failed:', error);
        res(boom.badImplementation('Error', error));
      });
  },

};



function proceedLTI(req, res, ltiObj){
  //console.log('proceedLTI');
  //console.log('proceedLTI.lti.id='+ltiObj._id+ ', lti.members.length='+ltiObj.members.length);

  var user = getUser(req);

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
              console.log('ltiObj.members.length before='+ltiObj.members.length);
              let member = {
                userid: newUserId,
                joined: (new Date()).toISOString()
              };
              ltiObj.members.push(member);
              console.log('ltiObj.members.length after='+ltiObj.members.length);

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
        //  .redirect(PLATFORM_LTI_URL + '?resource_id='+resource_id+'&data=' + encodeURIComponent(JSON.stringify(data)))
        //  .temporary(true);
      }

    }).catch((error) => {
      //console.log('Error - util.isIdentityAssigned('+user.email+', '+user.username+') failed:', error);
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


function getUser(req){
  //let username = util.parseAPIParameter(req.payload.ext_user_username).replace(/\s/g,'') || document.username.replace(/\s/g,'');
  console.log('req.payload.ext_user_username='+req.payload.ext_user_username);
  let username = util.parseAPIParameter(req.payload.ext_user_username).replace(/\s/g,'')+LTI_ID;
  var email = 'temp@temp.com';

  return {
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
