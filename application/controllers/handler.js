/*
Handles the requests by executing stuff and replying to the client. Uses promises to get stuff done.
*/
/* eslint promise/always-return: "off" */
/*eslint no-case-declarations: "warn"*/
/*eslint no-useless-escape: "warn"*/
/*eslint no-inner-declarations: "warn"*/

'use strict';

const boom = require('boom'), //Boom gives us some predefined http codes and proper responses
  co = require('../common'),
  userCtrl = require('../database/user'),
  usergroupCtrl = require('../database/usergroup'),
  userltiCtrl = require('../database/userlti'),
  config = require('../configuration'),
  jwt = require('./jwt'),
  Joi = require('joi'),
  util = require('./util'),
  request = require('request'),
  PLATFORM_INFORMATION_URL = require('../configs/microservices').platform.uri + '',
  queueAPI = require('../queue/api.js'),
  COLLECTION_SUSPENDEDUSERIDS = 'useridsforsuspension',
  helper = require('../database/helper');

module.exports = {
  register: (req, res) => {
    let user = {
      surname:  util.parseAPIParameter(req.payload.surname),
      forename: util.parseAPIParameter(req.payload.forename),
      username: util.parseAPIParameter(req.payload.username).replace(/\s/g,''),
      email:    util.parseAPIParameter(req.payload.email).toLowerCase(),
      password: co.hashPassword(util.parseAPIParameter(req.payload.password), config.SALT),
      frontendLanguage: util.parseAPIParameter(req.payload.language),
      country: '',
      picture: '',
      description: '',
      organization: util.parseAPIParameter(req.payload.organization),
      registered: (new Date()).toISOString(),
      providers: [],
      activate_secret: require('crypto').randomBytes(64).toString('hex'),
      authorised: false
    };

    //check if username already exists
    return util.isIdentityAssigned(user.email, user.username)
      .then((result) => {
        console.log('identity already taken: ', user.email, user.username, result);
        if (result.assigned === false) {
          //Send email before creating the user
          let message = 'Dear '+user.forename+' '+user.surname+',\n\nwelcome to SlideWiki! You have registered your account with the username '+user.username+'. In order to activate your account please use the following link:\n\n https://'+req.info.host+'/user/activate/'+user.email+'/'+user.activate_secret+'\n\nGreetings,\nthe SlideWiki Team';
          if (!config.SMTP.enabled) {
            user.authorised = true;
          }
          return util.sendEMail(user.email,
            'Your new account on SlideWiki',
            message)
            .then(() => {
              return userCtrl.create(user)
                .then((result) => {
                  // console.log('register: user create result: ', result);

                  if (result[0] !== undefined && result[0] !== null) {
                    //Error
                    return res(boom.badData('registration failed because data is wrong: ', co.parseAjvValidationErrors(result)));
                  }

                  if (result.insertedCount === 1) {
                    //success
                    return res({
                      userid: result.insertedId,
                      secret: user.activate_secret
                    });
                  }

                  res(boom.badImplementation());
                })
                .catch((error) => {
                  console.log('Error on creating a user:', error);
                  res(boom.badImplementation('Error', error));
                });
            })
            .catch((error) => {
              console.log('Error sending the email:', error);
              return res(boom.badImplementation('Error', error));
            });
        } else {
          let message = 'The username and email is already taken';
          if (result.email === false)
            message = 'The username is already taken';
          if (result.username === false)
            message = 'The email is already taken';
          return res(boom.conflict(message));
        }
      })
      .catch((error) => {
        delete user.password;
        console.log('Error:', error, 'with user:', user);
        res(boom.badImplementation('Error', error));
      });
  },

  activateUser: (req, res) => {
    const email = util.parseAPIParameter(req.params.email),
      secret = util.parseAPIParameter(req.params.secret);

    const query = {
      email: email,
      activate_secret: secret,
      authorised: false
    };

    console.log('trying to activate ', email);

    return userCtrl.partlyUpdate(query, {
      $set: {
        authorised: true
      }
    })
      .then((result) => {
        // console.log(result.result);
        if (result.result.ok === 1 && result.result.n === 1) {
          //success
          return res()
            .redirect(PLATFORM_INFORMATION_URL + '/account-activated')
            .temporary(true);
        }

        return res(boom.forbidden('Wrong credentials were used'));
      })
      .catch((error) => {
        console.log('Error:', error);
        return res(boom.badImplementation());
      });
  },

  login: (req, res) => {
    const query = {
      email: req.payload.email.toLowerCase(),
      password: co.hashPassword(decodeURI(req.payload.password), config.SALT)
    };
    console.log('try logging in with email', query.email);

    return userCtrl.find(query)
      .then((cursor) => cursor.toArray())
      .then((result) => {
        switch (result.length) {
          case 0:
            res(boom.notFound('The credentials are wrong', '{"email":"", "password": ""}'));
            break;
          case 1:
            console.log('login: user object:', result[0]._id, result[0].username, result[0].registered);

            //TODO: call authorization service for OAuth2 token

            if (result[0].deactivated === true) {
              res(boom.locked('This user is deactivated.'));
              break;
            }

            //check if authorised
            if (result[0].authorised === false) {
              res(boom.locked('User is not authorised yet.'));
              break;
            }

            //check if SPAM
            if (result[0].suspended === true) {
              res(boom.forbidden('The user is marked as SPAM.'));
              break;
            }

            res({
              userid: result[0]._id,
              username: result[0].username,
              picture: result[0].picture,
              access_token: 'dummy',
              expires_in: 0,
              displayName: result[0].displayName
            })
              .header(config.JWT.HEADER, jwt.createToken(result[0]));
            break;
          default:
            res(boom.badImplementation('Found multiple users'));
            break;
        }
      })
      .catch((error) => {
        console.log('Error: ', error);
        res(boom.badImplementation(error));
      });
  },

  getUser: (req, res) => {
    //check if the request comes from the right user (have the right JWT data)
    const isUseridMatching = util.isJWTValidForTheGivenUserId(req);
    if (!isUseridMatching) {
      return res(boom.forbidden('You cannot get detailed information about another user'));
    }

    return userCtrl.read(util.parseStringToInteger(req.params.id))
      .then((user) => {
        if (user !== undefined && user !== null && user.username !== undefined) {
          if (user.deactivated === true) {
            return res(boom.locked('This user is deactivated.'));
          }

          return usergroupCtrl.readGroupsOfUser(req.params.id)
            .then((groupArray) => {
              user.groups = groupArray;

              return userltiCtrl.readLTIsOfUser(req.params.id)
                .then((ltiArray) => {
                  user.ltis = ltiArray;

                  return res(prepareDetailedUserData(user)).header(config.JWT.HEADER, jwt.createToken(user));
                }) //end return userltiCtrl
                .catch((error) => {
                  console.log('Error while getting LTIs of the user with id '+req.params.id+':', error);
                  res(boom.notFound('Wrong user id', error));
                });
            }) //end return usergroupCtrl
            .catch((error) => {
              console.log('Error while getting groups of the user with id '+req.params.id+':', error);
              res(boom.notFound('Wrong user id', error));
            });
        }
        else {
          return res(boom.notFound());
        }
      })
      .catch((error) => {
        console.log('Error while getting user with id '+req.params.id+':', error);
        res(boom.notFound('Wrong user id', error));
      });
  },

  //add attribute "deactivated" to user document
  deleteUser: (req, res) => {
    let userid = util.parseStringToInteger(req.params.id);

    //check if the user which should be deleted have the right JWT data
    const isUseridMatching = util.isJWTValidForTheGivenUserId(req);
    if (!isUseridMatching) {
      return res(boom.forbidden('You cannot delete another user'));
    }

    const findQuery = {
      _id: userid
    };
    const updateQuery = {
      $set: {
        deactivated: true
      }
    };

    return userCtrl.partlyUpdate(findQuery, updateQuery)
      .then((result) => {
        // console.log('deleteUser: delete with', userid, 'results in', result.result);
        if (result.result.ok === 1 && result.result.n === 1) {
          //success
          return res();
        }

        res(boom.notFound('Deletion failed - no matched id'));
      })
      .catch((error) => {
        console.log('Error while deleting user with id '+userid+':', error);
        return res(boom.badImplementation('Deletion failed', error));
      });
  },

  //User profile
  updateUserPasswd: (req, res) => {
    let oldPassword = co.hashPassword(req.payload.oldPassword, config.SALT);
    let newPassword = co.hashPassword(req.payload.newPassword, config.SALT);
    const user__id = util.parseStringToInteger(req.params.id);

    //check if the user which should be updated have the right JWT data
    const isUseridMatching = util.isJWTValidForTheGivenUserId(req);
    if (!isUseridMatching) {
      return res(boom.forbidden('You cannot change the password of another user'));
    }

    //check if old password is correct
    return userCtrl.find({
      _id: user__id,
      password: oldPassword
    })
      .then((cursor) => cursor.count())
      .then((count) => {
        switch (count) {
          case 0:
            res(boom.notFound('There is no user with this Id and password'));
            break;
          case 1:
            const findQuery = {
                _id: user__id,
                password: oldPassword
              },
              updateQuery = {
                $set: {
                  password: newPassword
                }
              };

            return userCtrl.partlyUpdate(findQuery, updateQuery)
              .then((result) => {
                console.log('handler: updateUserPasswd:',  result.result);
                if (result.result.ok === 1 && result.result.n === 1) {
                  //success
                  return res();
                }

                res(boom.badImplementation());
              })
              .catch((error) => {
                console.log('Error while updating password of user with id '+user__id+':', error);
                res(boom.badImplementation('Update password failed', error));
              });
          default:
            //should not happen
            console.log('BIG PROBLEM: multiple users in the database have the same id and password!');
            res(boom.badImplementation('Found multiple users'));
            break;
        }
      })
      .catch((error) => {
        console.log('Error while updating password of user with id '+user__id+':', error);
        return res(boom.badImplementation('Update password failed', error));
      });
  },

  updateUserProfile: (req, res) => {
    let email = req.payload.email.toLowerCase();
    let user = req.payload;
    user.email = email;
    user._id = util.parseStringToInteger(req.params.id);

    //check if the user which should be updated have the right JWT data
    const isUseridMatching = util.isJWTValidForTheGivenUserId(req);
    if (!isUseridMatching) {
      return res(boom.forbidden('You cannot change the user profile of another user'));
    }

    let updateCall = function() {
      const findQuery = {
          _id: user._id
        },
        updateQuery = {
          $set: {
            email:       email,
            username:    util.parseAPIParameter(req.payload.username),
            surname:     util.parseAPIParameter(req.payload.surname),
            forename:    util.parseAPIParameter(req.payload.forename),
            frontendLanguage:    util.parseAPIParameter(req.payload.language),
            country:     util.parseAPIParameter(req.payload.country),
            picture:     util.parseAPIParameter(req.payload.picture),
            description: util.parseAPIParameter(req.payload.description),
            organization: util.parseAPIParameter(req.payload.organization),
            displayName: util.parseAPIParameter(req.payload.displayName)
          }
        };

      return userCtrl.partlyUpdate(findQuery, updateQuery)
        .then((result) => {
          if (result.result.ok === 1 && result.result.n === 1) {
            //success
            return res();
          }

          console.log('Update query failed with query and result:', updateQuery, result.result);
          return res(boom.badImplementation());
        })
        .catch((error) => {
          console.log('Update query failed with query and error:', updateQuery, error);
          return res(boom.notFound('Profile update failed', error));
        });
    };

    //find user and check if username has changed
    return userCtrl.find({_id: user._id})
      .then((cursor) => cursor.project({username: 1, email: 1}))
      .then((cursor2) => cursor2.next())
      .then((document) => {
        // console.log('handler: updateUserProfile: got user as document', document);

        if (document === null)
          return res(boom.notFound('No user with the given id'));

        const oldUsername = document.username,
          oldEMail = document.email;

        if (decodeURI(req.payload.username).toLowerCase() !== oldUsername.toLowerCase()) {
          return res(boom.notAcceptable('It is impossible to change the username!'));
        }

        if (email === oldEMail) {
          return updateCall();
        }
        else {
          //check if email already exists
          return isEMailAlreadyTaken(email)
            .then((isTaken) => {
              if (isTaken === false) {
                return updateCall();
              } else {
                return res(boom.conflict('The email is already taken'));
              }
            });
        }
      })
      .catch((error1) => {
        delete user.picture;
        console.log('handler: updateUserProfile: Error while getting user', error1, 'the user is:', user);

        const error = boom.badImplementation('Unknown error');

        error.output.payload.custom = error1;

        return res(error);
      });
  },

  getPublicUser: (req, res) => {
    let identifier = decodeURI(req.params.identifier).replace(/\s/g,'');
    let query = {};

    //validate identifier if its an integer or a username
    const integerSchema = Joi.number().integer();
    const validationResult = Joi.validate(identifier, integerSchema);
    if (validationResult.error === null) {
      query._id = validationResult.value;
    }
    else {
      // console.log('no integer try reading as username');
      let schema = Joi.string().regex(/^[\w\-.~]*$/);
      let valid = Joi.validate(identifier, schema);

      if (valid.error === null) {
        query.username = valid.value;
      }
      else {
        console.log('username is invalid:', identifier, valid.error);
        return res(boom.notFound());
      }
    }

    // check for static user first
    let staticUser = userCtrl.findStaticUser(query);
    if (staticUser) {
      return res(preparePublicUserData(staticUser));
    }

    //if no static user and username is given then use regex case insensitive
    if (query.username)
      query.username = new RegExp('^' + query.username + '$', 'i');

    console.log(query);

    return userCtrl.find(query)
      .then((cursor) => cursor.toArray())
      .then((array) => {
        console.log('handler: getPublicUser: ', query, array.length);

        if (array.length === 0)
          return res(boom.notFound());
        if (array.length > 1)
          return res(boom.badImplementation());

        if (array[0].deactivated === true) {
          return res(boom.locked('This user is deactivated.'));
        }

        //check if authorised
        if (array[0].authorised === false) {
          return res(boom.locked('User is not authorised yet.'));
        }

        res(preparePublicUserData(array[0]));
      })
      .catch((error) => {
        console.log('handler: getPublicUser: Error', error);
        res(boom.notFound('Wrong user identifier?', error));
      });
  },

  checkUsername: (req, res) => {
    // console.log(req.params);

    let username = decodeURI(req.params.username).replace(/\s/g,'');
    let schema = Joi.string().regex(/^[\w\-.~]*$/);
    let valid = Joi.validate(username, schema);

    if (valid.error === null) {
      username = valid.value;
    }
    else {
      console.log('username is invalid:', username, valid.error);
      return res({taken: true, alsoTaken: []});
    }

    return userCtrl.find({
      username: new RegExp('^' + username + '$', 'i')
    })
      .then((cursor) => cursor.count())
      .then((count) => {
        //console.log('checkUsername: username:', username, '  cursor.count():', count);

        // init this here because we may have to include a static user name
        let staticUserNames = [];
        if (count === 0) {
          // also check if it's in static users
          let staticUser = userCtrl.findStaticUserByName(username);
          if (staticUser) {
            staticUserNames.push(staticUser.username);
          } else {
            // not found as before
            return res({taken: false, alsoTaken: []});
          }
        }

        const query = {
          username: new RegExp(username + '*', 'i')
        };

        return userCtrl.find(query)
          .then((cursor1) => cursor1.project({username: 1}))
          .then((cursor2) => cursor2.limit(40))
          .then((cursor3) => cursor3.toArray())
          .then((array) => {
            //console.log('handler: checkUsername: similar usernames', array);
            let alreadyTaken = array.reduce((prev, curr) => {
              prev.push(curr.username);
              return prev;
            }, staticUserNames);
            return res({taken: true, alsoTaken: alreadyTaken});
          });
      })
      .catch((error) => {
        console.log('handler: checkUsername: error', error);
        res(boom.badImplementation(error));
      });
  },

  searchUser: (req, res) => {
    let term = decodeURI(req.params.term);

    if (term === undefined || term === null || term === '') {
      term = '\w*';
    }

    const query = {
      $or: [
        {username: new RegExp(term, 'i')},
        {email: new RegExp(term, 'i')},
        {forename: new RegExp(term, 'i')},
        {surname: new RegExp(term, 'i')},
        {organization: new RegExp(term, 'i')},
        {displayName: new RegExp(term, 'i')}
      ],
      deactivated: {
        $not: {
          $eq: true
        }
      },
      suspended: {
        $not: {
          $eq: true
        }
      },
      authorised: {
        $not: {
          $eq: false
        }
      }
    };

    // console.log('query:', query);

    return userCtrl.find(query)
      .then((cursor1) => cursor1.project({username: 1, _id: 1, picture: 1, country: 1, organization: 1, displayName: 1}))
      .then((cursor2) => cursor2.limit(8))
      .then((cursor3) => cursor3.toArray())
      .then((array) => {
        // console.log('handler: searchUser: similar usernames', array);
        let data = array.reduce((prev, curr) => {
          let description = curr.displayName || curr.username;
          if (curr.organization)
            description = description + ', ' + curr.organization;
          if (curr.country)
            description = description + ' (' + curr.country + ')';
          prev.push({
            name: description,
            value: encodeURIComponent(JSON.stringify({
              userid: curr._id,
              picture: curr.picture,
              country: curr.country,
              organization: curr.organization,
              username: curr.username,
              displayName: curr.displayName
            }))
          });
          return prev;
        }, []);
        return res({success: true, results: data});
      })
      .catch((error) => {
        console.log('handler: searchUser: error', error, 'with query:', query);
        res({success: false, results: []});
      });
  },

  checkEmail: (req, res) => {
    const email = decodeURI(req.params.email).replace(/\s/g,'').toLowerCase();

    return userCtrl.find({
      email: email
    })
      .then((cursor) => cursor.count())
      .then((count) => {
        //console.log('checkEmail: username:', username, '  cursor.count():', count);
        if (count === 0) {
          return res({taken: false});
        }

        return res({taken: true});
      })
      .catch((error) => {
        console.log('handler: checkEmail: error', error);
        res(boom.badImplementation(error));
      });
  },

  resetPassword: (req, res) => {
    const email = req.payload.email.toLowerCase();
    const APIKey = req.payload.APIKey;
    const salt = req.payload.salt;

    if (APIKey !== config.SMTP.APIKey) {
      return res(boom.forbidden('Wrong APIKey was used'));
    }

    return isEMailAlreadyTaken(email)
      .then((isTaken) => {
        console.log('resetPassword: email taken:', isTaken);
        if (!isTaken) {
          return res(boom.notFound('EMail adress is not taken.'));
        }

        const newPassword = require('crypto').randomBytes(9).toString('hex');
        /* The password is hashed one time at the client site (inner hash and optional) and one time at server-side. As we currently only have one salt, it must be the same for slidewiki-platform and the user-service. In case this is splitted, the user-service must know both salts in order to be able to generate a valid password for resetPassword.*/
        let hashedPassword = co.hashPassword(newPassword, config.SALT);
        if (salt && salt.length > 0)
          hashedPassword = co.hashPassword(co.hashPassword(newPassword, salt), config.SALT);

        console.log('resetPassword: email is in use thus we connect to the SMTP server');

        let connectionPromise = util.sendEMail(email,
          'Password reset on SlideWiki',
          'Dear SlideWiki user,\n\na request has been made to reset your password.\n\nYour new password is: ' + newPassword + '\n\nPlease login with this password and then go to My Settings > Account to change it. Passwords should have 8 characters or more.\n\nThanks,\nthe SlideWiki Team');

        return connectionPromise
          .then((data) => {
            console.log('connectionPromise returned', data);

            //change password in the database
            const findQuery = {
              email: email
            };
            const updateQuery = {
              $set: {
                password: hashedPassword
              }
            };
            return userCtrl.partlyUpdate(findQuery, updateQuery)
              .then((result) => {
                console.log('handler: resetPassword:',  result.result);

                if (!config.SMTP.enabled) {
                  console.log('Changed password of user with email ' + email + ' to ' + newPassword);
                }

                if (result.result.ok === 1 && result.result.n === 1) {
                  //success
                  return res(data.message);
                }

                return res(boom.badImplementation());
              })
              .catch((error) => {
                res(boom.notFound('Update of user password failed', error));
              });
          })
          .catch((error) => {
            console.log('Error:', error);
            return res(boom.badImplementation(error));
          });
      })
      .catch((error) => {
        console.log('Error:', error);
        return res(boom.badImplementation(error));
      });
  },

  //groups
  deleteUsergroup: (req, res) => {
    //first check if user is creator
    return usergroupCtrl.read(req.params.groupid)
      .then((document) => {
        if (document === undefined || document === null) {
          return res(boom.notFound());
        }

        let creator = document.creator.userid || document.creator;
        if (creator !== req.auth.credentials.userid) {
          return res(boom.unauthorized());
        }

        //now delete
        return usergroupCtrl.delete(req.params.groupid)
          .then((result) => {
            // console.log('deleteUsergroup: deleted', result.result);

            if (result.result.ok !== 1) {
              return res(boom.badImplementation());
            }

            if (result.result.n !== 1) {
              return res(boom.notFound());
            }

            if (document.members.length < 1)
              return res();

            //notify users
            let promises = [];
            document.members.forEach((member) => {
              promises.push(notifiyUser({
                id: creator,
                name: document.creator.username || 'Group leader'
              }, member.userid, 'left', document, true));
            });
            return Promise.all(promises).then(() => {
              return res();
            }).catch((error) => {
              console.log('Error while processing notification of users:', error);
              //reply(boom.badImplementation());
              //for now always succeed
              return res();
            });
          });
      })
      .catch((error) => {
        console.log('error while reading or deleting the usergroup '+req.params.groupid+':', error);
        res(boom.badImplementation(error));
      });
  },

  createOrUpdateUsergroup: (req, res) => {
    const userid = req.auth.credentials.userid;

    let group = req.payload;

    let possibleCreator = {
      userid: userid,
      username: req.auth.credentials.username
    };

    let referenceDateTime = util.parseAPIParameter(req.payload.referenceDateTime) || (new Date()).toISOString();
    delete group.referenceDateTime;

    group.description = util.parseAPIParameter(group.description);
    group.name = util.parseAPIParameter(group.name);
    group.timestamp = util.parseAPIParameter(group.timestamp);

    if (group.timestamp === undefined || group.timestamp === null || group.timestamp === '')
      group.timestamp = referenceDateTime;

    if (group.isActive !== false)
      group.isActive = true;
    if (group.members === undefined || group.members === null || group.members.length < 0)
      group.members = [];

    //add joined attribute if not given
    group.members = group.members.reduce((array, user) => {
      if (user.joined === undefined || user.joined === '')
        user.joined = referenceDateTime;
      array.push(user);
      return array;
    }, []);

    if (group.id === undefined || group.id === null) {
      //create
      console.log('create group', group.name);

      group.creator = possibleCreator;

      return usergroupCtrl.create(group)
        .then((result) => {
          // console.log('createOrUpdateUsergroup: created group', result.result || result);

          if (result[0] !== undefined && result[0] !== null) {
            //Error
            return res(boom.badData('Wrong data: ' + JSON.stringify(co.parseAjvValidationErrors(result))));
          }

          if (result.insertedCount === 1) {
            //success
            group.id = result.insertedId;

            if (group.members.length < 1)
              return res(group);

            //notify users
            console.log('Notify '+group.members.length+' users...');
            let promises = [];
            group.members.forEach((member) => {
              promises.push(notifiyUser({
                id: group.creator.userid || group.creator,
                name: group.creator.username || 'Group leader'
              }, member.userid, 'joined', group, true));
            });
            return Promise.all(promises).then(() => {
              return res(group);
            }).catch((error) => {
              console.log('Error while processing notification of users:', error);
              //reply(boom.badImplementation());
              //for now always succeed
              return res(group);
            });
          }

          res(boom.badImplementation());
        })
        .catch((error) => {
          console.log('Error while creating group:', error, group);
          res(boom.badImplementation(error));
        });
    }
    else if (group.id < 1) {
      //error
      return res(boom.badData('Group id is not valid'));
    }
    else {
      //update
      console.log('update group', group.id);

      //first check if user is creator
      return usergroupCtrl.read(group.id)
        .then((document) => {
          if (document === undefined || document === null) {
            return res(boom.notFound());
          }

          let dCreator = document.creator.userid || document.creator;
          let isAdmin = document.members.some((m) => m.userid === userid && m.role === 'admin');
          if (dCreator !== userid && !isAdmin) {
            return res(boom.unauthorized());
          }

          //some attributes should be unchangeable
          group.timestamp = document.timestamp;
          group._id = document._id;
          group.creator = document.creator;

          return usergroupCtrl.update(group)
            .then((result) => {
              // console.log('createOrUpdateUsergroup: updated group', result.result || result);

              if (result[0] !== undefined && result[0] !== null) {
                //Error
                return res(boom.badData('Wrong data: ' + JSON.stringify(co.parseAjvValidationErrors(result))));
              }

              if (result.result.ok === 1) {
                if (group.members.length < 1 && document.members.length < 1)
                  return res(group);

                //notify users
                let wasUserAMember = (userid) => {
                  let result = false;
                  document.members.forEach((member) => {
                    if (member.userid === userid)
                      result = true;
                  });
                  return result;
                };
                let wasUserDeleted = (userid) => {
                  let result = true;
                  group.members.forEach((member) => {
                    if (member.userid === userid)
                      result = false;
                  });
                  return result;
                };
                let promises = [];
                group.members.forEach((member) => {
                  if (!wasUserAMember(member.userid))
                    promises.push(notifiyUser({
                      id: group.creator.userid,
                      name: group.creator.username || 'Group leader'
                    }, member.userid, 'joined', group, true));
                });
                document.members.forEach((member) => {
                  if (wasUserDeleted(member.userid))
                    promises.push(notifiyUser({
                      id: dCreator,
                      name: document.creator.username || 'Group leader'
                    }, member.userid, 'left', document, true));
                });
                console.log('Notify '+promises.length+' users...');
                return Promise.all(promises).then(() => {
                  return res(group);
                }).catch((error) => {
                  console.log('Error while processing notification of users:', error);
                  //reply(boom.badImplementation());
                  //for now always succeed
                  return res(group);
                });
              }

              console.log('Failed updating group '+group._id+' and got result:', result.result, group);
              return res(boom.badImplementation());
            });
        })
        .catch((error) => {
          console.log('Error while reading group '+group.id+':', error);
          res(boom.badImplementation(error));
        });
    }
  },


  getUsergroups: (req, res) => {
    if (req.payload === undefined || req.payload.length < 1)
      return res(boom.badData());

    let selectors = req.payload.reduce((q, element) => {
      q.push({_id: element});
      return q;
    }, []);
    let query = {
      $or: selectors
    };

    console.log('getUsergroups:', query);

    return usergroupCtrl.find(query)
      .then((cursor) => cursor.toArray())
      .then((array) => {
        if (array === undefined || array === null || array.length < 1) {
          return res([]);
        }

        let enrichedGroups_promises = array.reduce((prev, curr) => {
          prev.push(enrichGroupMembers(curr));
          return prev;
        }, []);
        return Promise.all(enrichedGroups_promises)
          .then((enrichedGroups) => {
            return res(enrichedGroups);
          });
      })
      .catch((error) => {
        console.log('Error while reading groups:', error);
        res(boom.badImplementation(error));
      });
  },


  leaveUsergroup: (req, res) => {
    return usergroupCtrl.partlyUpdate({
      _id: req.params.groupid
    }, {
      $pull: {
        members: {
          userid: req.auth.credentials.userid
        }
      }
    }).
      then((result) => {
        console.log('leaveUsergroup: ', result.result);
        if (result.result.ok !== 1)
          return res(boom.notFound());

        if (result.result.nModified !== 1)
          return res(boom.unauthorized());

        return res();
      });
  },


  //ltis
  deleteUserlti: (req, res) => {
    //first check if user is creator
    return userltiCtrl.read(req.params.ltiid)
      .then((document) => {
        if (document === undefined || document === null) {
          return res(boom.notFound());
        }

        let creator = document.creator.userid || document.creator;
        if (creator !== req.auth.credentials.userid) {
          return res(boom.unauthorized());
        }

        //now delete
        return userltiCtrl.delete(req.params.ltiid)
          .then((result) => {
            // console.log('deleteUserlti: deleted', result.result);

            if (result.result.ok !== 1) {
              return res(boom.badImplementation());
            }

            if (result.result.n !== 1) {
              return res(boom.notFound());
            }

            if (document.members.length < 1)
              return res();

            //notify users
            let promises = [];
            document.members.forEach((member) => {
              promises.push(notifiyLTIUser({
                id: creator,
                name: document.creator.username || 'LTI leader'
              }, member.userid, 'left', document, true));
            });
            return Promise.all(promises).then(() => {
              return res();
            }).catch((error) => {
              console.log('Error while processing notification of users:', error);
              //reply(boom.badImplementation());
              //for now always succeed
              return res();
            });
          });
      })
      .catch((error) => {
        console.log('error while reading or deleting the userlti '+req.params.ltiid+':', error);
        res(boom.badImplementation(error));
      });
  },



  createOrUpdateUserlti: (req, res) => {

    console.log('handlers.createOrUpdateUserlti');
    const userid = req.auth.credentials.userid;

    let lti = req.payload;

    lti.creator = {
      userid: userid,
      username: req.auth.credentials.username
    };

    let referenceDateTime = util.parseAPIParameter(req.payload.referenceDateTime) || (new Date()).toISOString();
    delete lti.referenceDateTime;

    lti.key = util.parseAPIParameter(lti.key);
    lti.secret = util.parseAPIParameter(lti.secret);
    lti.timestamp = util.parseAPIParameter(lti.timestamp);

    if (lti.timestamp === undefined || lti.timestamp === null || lti.timestamp === '')
      lti.timestamp = referenceDateTime;

    if (lti.isActive !== false)
      lti.isActive = true;
    if (lti.members === undefined || lti.members === null || lti.members.length < 0)
      lti.members = [];

    //add joined attribute if not given
    lti.members = lti.members.reduce((array, user) => {
      if (user.joined === undefined || user.joined === '')
        user.joined = referenceDateTime;
      array.push(user);
      return array;
    }, []);

    if (lti.id === undefined || lti.id === null) {
      //create
      console.log('create lti', lti.key);

      return userltiCtrl.create(lti)
        .then((result) => {
          // console.log('createOrUpdateUserlti: created lti', result.result || result);

          if (result[0] !== undefined && result[0] !== null) {
            //Error
            return res(boom.badData('Wrong data: ', co.parseAjvValidationErrors(result)));
          }

          if (result.insertedCount === 1) {
            //success
            lti.id = result.insertedId;

            if (lti.members.length < 1)
              return res(lti);

            //notify users
            console.log('Notify '+lti.members.length+' users...');
            let promises = [];
            lti.members.forEach((member) => {
              promises.push(notifiyUser({
                id: lti.creator.userid || lti.creator,
                name: lti.creator.username || 'LTI leader'
              }, member.userid, 'joined', lti, true));
            });
            return Promise.all(promises).then(() => {
              return res(lti);
            }).catch((error) => {
              console.log('Error while processing notification of users:', error);
              //reply(boom.badImplementation());
              //for now always succeed
              return res(lti);
            });
          }

          res(boom.badImplementation());
        })
        .catch((error) => {
          console.log('Error while creating lti:', error, lti);
          res(boom.badImplementation(error));
        });
    }
    else if (lti.id < 1) {
      //error
      return res(boom.badData());
    }
    else {
      //update
      console.log('update lti', lti.id);

      //first check if user is creator
      return userltiCtrl.read(lti.id)
        .then((document) => {
          if (document === undefined || document === null) {
            return res(boom.notFound());
          }

          let dCreator = document.creator.userid || document.creator;
          if (dCreator !== lti.creator.userid) {
            return res(boom.unauthorized());
          }

          //some attribute should be unchangeable
          lti.timestamp = document.timestamp;
          lti._id = document._id;

          return userltiCtrl.update(lti)
            .then((result) => {
              // console.log('createOrUpdateUserlti: updated lti', result.result || result);

              if (result[0] !== undefined && result[0] !== null) {
                //Error
                return res(boom.badData('Wrong data: ', co.parseAjvValidationErrors(result)));
              }

              if (result.result.ok === 1) {
                if (lti.members.length < 1 && document.members.length < 1)
                  return res(lti);

                //notify users
                let wasUserAMember = (userid) => {
                  let result = false;
                  document.members.forEach((member) => {
                    if (member.userid === userid)
                      result = true;
                  });
                  return result;
                };
                let wasUserDeleted = (userid) => {
                  let result = true;
                  lti.members.forEach((member) => {
                    if (member.userid === userid)
                      result = false;
                  });
                  return result;
                };
                let promises = [];
                lti.members.forEach((member) => {
                  if (!wasUserAMember(member.userid))
                    promises.push(notifiyUser({
                      id: lti.creator.userid,
                      name: lti.creator.username || 'LTI leader'
                    }, member.userid, 'joined', lti, true));
                });
                document.members.forEach((member) => {
                  if (wasUserDeleted(member.userid))
                    promises.push(notifiyUser({
                      id: dCreator,
                      name: document.creator.username || 'Group leader'
                    }, member.userid, 'left', document, true));
                });
                console.log('Notify '+promises.length+' users...');
                return Promise.all(promises).then(() => {
                  return res(lti);
                }).catch((error) => {
                  console.log('Error while processing notification of users:', error);
                  //reply(boom.badImplementation());
                  //for now always succeed
                  return res(lti);
                });
              }

              console.log('Failed updating lti '+lti._id+' and got result:', result.result, lti);
              return res(boom.badImplementation());
            });
        })
        .catch((error) => {
          console.log('Error while reading lti '+lti.id+':', error);
          res(boom.badImplementation(error));
        });
    }
  },


  getUserltis: (req, res) => {
    if (req.payload === undefined || req.payload.length < 1)
      return res(boom.badData());

    let selectors = req.payload.reduce((q, element) => {
      q.push({_id: element});
      return q;
    }, []);
    let query = {
      $or: selectors
    };

    console.log('handler.getUserltis:', query);

    return userltiCtrl.find(query)
      .then((cursor) => cursor.toArray())
      .then((array) => {
        if (array === undefined || array === null || array.length < 1) {
          return res([]);
        }

        let enrichedLTIs_promises = array.reduce((prev, curr) => {
          prev.push(enrichLTIMembers(curr));
          return prev;
        }, []);
        return Promise.all(enrichedLTIs_promises)
          .then((enrichedLTIs) => {
            return res(enrichedLTIs);
          });
      })
      .catch((error) => {
        console.log('Error while reading ltis:', error);
        res(boom.badImplementation(error));
      });
  },


  //
  getUserdata: (req, res) => {
    return usergroupCtrl.readGroupsOfUser(req.auth.credentials.userid)
      .then((array) => {
        if (array === undefined || array === null)
          return res(boom.notFound());

        return res({
          id: req.auth.credentials.userid,
          username: req.auth.credentials.username,
          groups: array
        });
      })
      .catch((error) => {
        console.log('getUserdata('+req.auth.credentials.userid+') error:', error);
        res(boom.notFound('Wrong user id', error));
      });
  },

  getUsers: (req, res) => {
    if (req.payload === undefined || req.payload.length < 1)
      return res(boom.badData());

    // keep initial result for static users
    let staticUsers = userCtrl.findStaticUsersByIds(req.payload);

    let selectors = req.payload.reduce((q, element) => {
      q.push({_id: element});
      return q;
    }, []);
    let query = {
      $or: selectors
    };

    console.log('getUsers:', query);

    return userCtrl.find(query)
      .then((cursor) => cursor.toArray())
      .then((array) => {
        if (array === undefined || array === null || array.length < 1) {
          return res(staticUsers);
        }

        let publicUsers = array.reduce((array, user) => {
          array.push(preparePublicUserData(user));
          return array;
        }, staticUsers);
        return res(publicUsers);
      });
  },

  getReviewableUsers: (req, res) => {
    let query = {
      authorised: {
        $not: {
          $eq: false
        }
      },
      deactivated: {
        $not: {
          $eq: true
        }
      },
      reviewed: {
        $not: {
          $eq: true
        }
      }
    };

    return userCtrl.find(query)
      .then((cursor) => cursor.project({_id: 1, registered: 1, username: 1}))
      .then((cursor2) => cursor2.toArray())
      .then((array) => {
        if (array.length < 1)
          return res([]);

        // console.log('filter users', array.length);
        let startTime = (new Date('2017-07-19')).getTime();
        let userids = array.reduce((arr, curr) => {
          if ((new Date(curr.registered)).getTime() > startTime)
            arr.push(curr._id);
          return arr;
        }, []);

        if (userids.length < 1)
          return res([]);

        //now call service
        const options = {
          url: require('../configs/microservices').deck.uri + '/deckOwners?user=' + userids.reduce((a, b) => {let r = a === '' ? b : a + ',' + b; return r;}, ''),
          method: 'GET',
          json: true,
          body: {
            userids: userids
          }
        };

        function callback(error, response, body) {
          // console.log('getReviewableUsers: ', error, response.statusCode, body);

          if (!error && (response.statusCode === 200)) {
            let result = body.reduce((arr, curr) => {
              if (curr.decksCount < 2)
                return arr;
              curr.decks = curr.decksCount;
              curr.userid = curr._id;
              curr.username = array.find((u) => {return u._id === curr.userid;}).username;
              arr.push(curr);
              return arr;
            }, []);
            return res(result);
          } else {
            console.log('Error', (response) ? response.statusCode : undefined, error, body);
            return res([]);
          }
        }

        // console.log('now calling the service');

        if (process.env.NODE_ENV === 'test') {
          callback(null, {statusCode: 200}, userids.reduce((arr, curr) => {arr.push({_id: curr, decksCount: 3}); return arr;}, []));
        }
        else
          request(options, callback);
      })
      .catch((error) => {
        console.log('Error', error);
        res([]);
      });
  },

  suspendUser: (req, res) => {
    return reviewUser(req, res, true);
  },

  approveUser: (req, res) => {
    return reviewUser(req, res, false);
  },

  getNextReviewableUser: (req, res) => {
    let secret = (req.query !== undefined && req.query.secret !== undefined) ? req.query.secret : undefined;
    // console.log('secret:', secret, 'correct secret:', process.env.SECRET_REVIEW_KEY, 'isreviewer:', req.auth.credentials.isReviewer);
    if (secret === undefined)
      return res(boom.unauthorized());

    if (!req.auth.credentials.isReviewer || secret !== process.env.SECRET_REVIEW_KEY)
      return res(boom.forbidden());

    console.log('getNextReviewableUser');
    return queueAPI.get()
      .then((user) => {
        console.log('got user', user);
        if (user === undefined) {
          return res(boom.notFound());
        }
        delete user._id;
        return res(user);
      })
      .catch((error) => {
        console.log('Error', error);
        res(boom.badImplementation());
      });
  },

  addToQueue: (req, res) => {
    let secret = (req.query !== undefined && req.query.secret !== undefined) ? req.query.secret : undefined;

    if (secret === undefined)
      return res(boom.unauthorized());

    if (!req.auth.credentials.isReviewer || secret !== process.env.SECRET_REVIEW_KEY)
      return res(boom.forbidden());

    const reviewerid = req.auth.credentials.userid;
    const userid = req.params.id;

    return userCtrl.read(userid)
      .then((user) => {
        if (!user)
          return res(boom.notFound());
        if (user.deactivated || user.authorised === false)
          return res(boom.locked());
        if (user.reviewed || user.suspended)
          return res(boom.conflict());

        return queueAPI.getAll()
          .then((users) => {
            if (users.findIndex((u) => {return u.userid === user._id;}) !== -1) {
              console.log('user is already in the queue');
              return res();//user is already in queue
            }

            let queueUser = queueAPI.getEmptyElement();
            queueUser.userid = user._id;
            queueUser.username = user.username;
            queueUser.decks = req.query.decks || 0;
            queueUser.addedByReviewer = reviewerid;

            return queueAPI.add(queueUser)
              .then((success) => {
                success ? res() : res(boom.badImplementation());
                return;
              })
              .catch((error) => {
                console.log('Error', error);
                res(boom.badImplementation(error));
              });
          })
          .catch((error) => {
            console.log('Error', error);
            res(boom.badImplementation(error));
          });
      })
      .catch((error) => {
        console.log('Error', error);
        res(boom.badImplementation(error));
      });
  },

  sendEmail: (req, res) => {
    switch (req.payload.reason) {
      case 1: { //request_deck_edit_rights
        //check data values
        if (!req.payload.data.deckname || !req.payload.data.deckid) {
          return res(boom.badRequest('payload.data was wrong'));
        }

        return userCtrl.find({_id: req.params.id})
          .then((cursor) => cursor.toArray())
          .then((array) => {
            if (array.length !== 1) {
              return res(boom.notFound());
            }

            let email = array[0].email;

            let connectionPromise = util.sendEMail(email,
              'User requested deck edit rights',
              'Dear SlideWiki user,\n\na request has been made by another user to acquire deck edit rights on your deck "' + req.payload.data.deckname + '". The request was made by ' + req.auth.credentials.username + '.\nIn order to grant the rights, use the following link: ' + PLATFORM_INFORMATION_URL + '/deck/' + req.payload.data.deckid + '/deck/' + req.payload.data.deckid + '/edit?interestedUser=' + req.auth.credentials.username + '\n\nIf you do not want to grant rights, then just ignore this email.\n\nThanks,\nthe SlideWiki Team');

            return connectionPromise
              .then((data) => {
                return res();
              })
              .catch((error) => {
                console.log('Error', error);
                res(boom.badImplementation(error));
              });
          })
          .catch((error) => {
            console.log('Error', error);
            res(boom.badImplementation(error));
          });
      }

      case 2: { //video recorded
        //check data values
        if (!req.payload.data.fileName || !req.payload.data.deck || !req.payload.data.creationDate) {
          return res(boom.badRequest('payload.data does not include all needed fields'));
        }

        return userCtrl.find({_id: req.params.id})
          .then((cursor) => cursor.toArray())
          .then((array) => {
            if (array.length !== 1) {
              return res(boom.notFound('User does not exist'));
            }

            let email = array[0].email;
            let videoURL = require('../configs/microservices').file.uri + '/video/' + req.payload.data.fileName;

            let connectionPromise = util.sendEMail(email,
              'New video about your live session of deck ' + req.payload.data.deck + ((req.payload.data.revision) ? '-'+req.payload.data.revision : ''),
              'Dear ' + array[0].username + ',\n\nwe have finshed the video about your live session of deck ' + req.payload.data.deck + ((req.payload.data.revision) ? '-'+req.payload.data.revision : '') + ' that ended at ' + req.payload.data.creationDate + '. Feel free to watch the video at: <a href="' + videoURL + '">' + videoURL + '</a>. if you want to download it, open the mentioned link, right click on the video and select "Save as ...". Please keep in mind we delete videos after eight weeks.\nFeel free to use, share and modify the video according to the license <a href="https://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 International (CC BY 4.0)</a>.\n\nYour SlideWiki Team');

            return connectionPromise
              .then(() => {
                return res();
              })
              .catch((error) => {
                console.log('Error', error);
                res(boom.badImplementation(error));
              });
          })
          .catch((error) => {
            console.log('Error', error);
            res(boom.badImplementation(error));
          });
      }

      default: {
        return res(boom.notFound('Bad reason id'));
      }
    }
  }
};

//get and remove user from queue and then add the userid to a list for later suspension
function reviewUser(req, res, suspended) {
  let secret = (req.query !== undefined && req.query.secret !== undefined) ? req.query.secret : undefined;

  if (secret === undefined)
    return res(boom.unauthorized());

  if (!req.auth.credentials.isReviewer || secret !== process.env.SECRET_REVIEW_KEY)
    return res(boom.forbidden());

  const reviewerid = req.auth.credentials.userid;
  const userid = req.params.id;

  let query = {
    _id: userid,
    authorised: {
      $not: {
        $eq: false
      }
    },
    deactivated: {
      $not: {
        $eq: true
      }
    },
    reviewed: {
      $not: {
        $eq: true
      }
    }
  };
  let update = {
    reviewed: true,
    lastReviewDoneBy: reviewerid
  };
  if (!suspended)
    update.suspended = suspended;
  update = {
    $set: update
  };
  return userCtrl.partlyUpdate(query, update)
    .then((result) => {
      if (result.result.ok === 1 && result.result.n === 1) {
        //found user and got updated

        if (!suspended)
          return res();

        //now add the userid to the list
        return helper.connectToDatabase()
          .then((dbconn) => dbconn.collection(COLLECTION_SUSPENDEDUSERIDS))
          .then((collection) => collection.insert({_id: userid}))
          .then((result2) => {
            if (result2.insertedCount === 1) {
              //success
              return res();
            }

            return res(boom.badImplementation());
          })
          .catch((error) => {
            console.log('Error while inserting userid into '+COLLECTION_SUSPENDEDUSERIDS+':', error);
            return res(boom.badImplementation());
          });
      }
      else
        return res(boom.notFound());
    })
    .catch((error) => {
      console.log('Error', error);
      res(boom.badImplementation());
    });
}

function isUsernameAlreadyTaken(username) {
  let myPromise = new Promise((resolve, reject) => {
    return userCtrl.find({
      username: username
    })
      .then((cursor) => cursor.count())
      .then((count) => {
        console.log('isUsernameAlreadyTaken: cursor.count():', count);
        if (count > 0) {
          resolve(true);
        } else {
          resolve(false);
        }
      })
      .catch((error) => {
        reject(error);
      });
  });
  return myPromise;
}

function isEMailAlreadyTaken(email) {
  let myPromise = new Promise((resolve, reject) => {
    return userCtrl.find({
      email: email
    })
      .then((cursor) => cursor.count())
      .then((count) => {
        console.log('isEMailAlreadyTaken: cursor.count():', count);
        if (count > 0) {
          resolve(true);
        } else {
          resolve(false);
        }
      })
      .catch((error) => {
        reject(error);
      });
  });
  return myPromise;
}

//Remove attributes of the user data object which should not be transmitted
function prepareDetailedUserData(user) {
  const hiddenKeys = ['password'];
  let minimizedUser = {};

  let key;
  for (key in user) {
    const found = hiddenKeys.find((hiddenKey) => {
      if (key === hiddenKey)
        return true;

      return false;
    });
    if (found === undefined) {
      minimizedUser[key] = user[key];
    }
  }

  //map attributes for better API
  minimizedUser.language = minimizedUser.frontendLanguage;
  minimizedUser.frontendLanguage = undefined;

  //add data for social provider stuff
  minimizedUser.hasPassword = true;
  if (user.password === undefined || user.password === null || user.password === '')
    minimizedUser.hasPassword = false;
  minimizedUser.providers = (user.providers || []).reduce((prev, cur) => {
    if (prev.indexOf(cur.provider) === -1) {
      prev.push(cur.provider);
      return prev;
    }
    return prev;
  }, []);

  return minimizedUser;
}

//Remove attributes of the user data object which should not be transmitted for the user profile
function preparePublicUserData(user) {
  const shownKeys = ['_id', 'username', 'organization', 'picture', 'description', 'country', 'suspended', 'displayName'];
  let minimizedUser = {};

  let key;
  for (key in user) {
    const found = shownKeys.find((shownkey) => {
      if (key === shownkey)
        return true;

      return false;
    });
    if (found !== undefined) {
      minimizedUser[key] = user[key];
    }
  }

  return minimizedUser;
}

function notifiyUser(actor, receiver, type, group, isActiveAction = false) {
  let promise = new Promise((resolve, reject) => {
    let message = actor.name + ': Has ' + type + ' the group ' + group.name;
    if (isActiveAction)
      message = 'You ' + type + ' the group ' + group.name;
    const options = {
      url: require('../configs/microservices').activities.uri + '/activity/new',
      method: 'POST',
      json: true,
      body: {
        activity_type: type,
        user_id: actor.id.toString(),
        content_id: group._id.toString(),
        content_kind: 'group',
        content_name: message,
        content_owner_id: receiver.toString()
      }
    };

    function callback(error, response, body) {
      // console.log('notifiyUser: ', error, response.statusCode, body);

      if (!error && (response.statusCode === 200)) {
        return resolve(body);
      } else {
        return reject(error);
      }
    }

    request(options, callback);
  });
  return promise;
}


function notifiyLTIUser(actor, receiver, type, lti, isActiveAction = false) {
  let promise = new Promise((resolve, reject) => {
    let message = actor.name + ': Has ' + type + ' the LTI Group ' + lti.key;
    if (isActiveAction)
      message = 'You ' + type + ' the LTI group ' + lti.key;
    const options = {
      url: require('../configs/microservices').activities.uri + '/activity/new',
      method: 'POST',
      json: true,
      body: {
        activity_type: type,
        user_id: actor.id.toString(),
        content_id: lti._id.toString(),
        content_kind: 'lti',
        content_name: message,
        content_owner_id: receiver.toString()
      }
    };

    function callback(error, response, body) {
      // console.log('notifiyUser: ', error, response.statusCode, body);

      if (!error && (response.statusCode === 200)) {
        return resolve(body);
      } else {
        return reject(error);
      }
    }

    request(options, callback);
  });
  return promise;
}


//Uses userids of creator and members in order to add username and picture
function enrichGroupMembers(group) {
  let userids = group.members.reduce((prev, curr) => {
    prev.push(curr.userid);
    return prev;
  }, []);
  const creatorid = (group.creator.userid) ? group.creator.userid : group.creator;
  userids.push(creatorid);

  console.log('enrichGroupMembers: group, userids', group, userids);

  let query = {
    _id: {
      $in: userids
    }
  };
  return userCtrl.find(query)
    .then((cursor) => cursor.project({_id: 1, username: 1, picture: 1, country: 1, organization: 1, displayName: 1}))
    .then((cursor2) => cursor2.toArray())
    .then((array) => {
      array = array.reduce((prev, curr) => {
        if (curr._id) {
          curr.userid = curr._id;
          delete curr._id;
        }
        prev.push(curr);
        return prev;
      }, []);
      let creator = array.filter((user) => {
        return user.userid === creatorid;
      });
      let members = array.filter((user) => {
        return user.userid !== creatorid;
      });

      console.log('enrichGroupMembers: got creator and users (amount)', {id: creator[0].userid, name: creator[0].username}, members.concat(group.members).length);

      //add joined attribute to members
      members = (members.concat(group.members)).reduce((prev, curr) => {
        if (prev[curr.userid] === undefined)
          prev[curr.userid] = {};

        if (curr.joined === undefined) {
          prev[curr.userid].userid = curr.userid;
          prev[curr.userid].username = curr.username;
          prev[curr.userid].picture = curr.picture;
          prev[curr.userid].country = curr.country;
          prev[curr.userid].organization = curr.organization;
          prev[curr.userid].displayName = curr.displayName;
        }
        else {
          prev[curr.userid].joined = curr.joined;
          prev[curr.userid].role = curr.role;
        }
        return prev;
      }, {});
      members = Object.keys(members).map((key) => { return members[key]; }).filter((member) => {return member.joined && member.userid && member.username;});

      group.creator = creator[0];
      group.members = members;

      console.log('enrichGroupMembers: got new members (after reading from database, adding joined attribute and cleanup), amount:', members.length);

      return group;
    });
}


//Uses userids of creator and members in order to add username and picture
function enrichLTIMembers(lti) {
  let userids = lti.members.reduce((prev, curr) => {
    prev.push(curr.userid);
    return prev;
  }, []);
  userids.push(lti.creator.userid);

  console.log('enrichLTIMembers: lti, userids', lti, userids);

  let query = {
    _id: {
      $in: userids
    }
  };
  return userCtrl.find(query)
    .then((cursor) => cursor.project({_id: 1, username: 1, picture: 1, country: 1, organization: 1}))
    .then((cursor2) => cursor2.toArray())
    .then((array) => {
      array = array.reduce((prev, curr) => {
        if (curr._id) {
          curr.userid = curr._id;
          delete curr._id;
        }
        prev.push(curr);
        return prev;
      }, []);
      let creator = array.filter((user) => {
        return user.userid === lti.creator.userid;
      });
      let members = array.filter((user) => {
        return user.userid !== lti.creator.userid;
      });

      console.log('enrichLTIMembers: got creator and users (amount)', {id: creator[0]._id, name: creator[0].username, email: creator[0].email}, members.concat(lti.members).length);

      //add joined attribute to members
      members = (members.concat(lti.members)).reduce((prev, curr) => {
        if (prev[curr.userid] === undefined)
          prev[curr.userid] = {};

        if (curr.joined === undefined) {
          prev[curr.userid].userid = curr.userid;
          prev[curr.userid].username = curr.username;
          prev[curr.userid].picture = curr.picture;
          prev[curr.userid].country = curr.country;
          prev[curr.userid].organization = curr.organization;
        }
        else
          prev[curr.userid].joined = curr.joined;
        return prev;
      }, {});
      members = Object.keys(members).map((key) => { return members[key]; }).filter((member) => {return member.joined && member.userid && member.username;});

      lti.creator = creator[0];
      lti.members = members;

      console.log('enrichLTIMembers: got new members (after reading from database, adding joined attribute and cleanup), amount:', members.length);

      return lti;
    });
}
