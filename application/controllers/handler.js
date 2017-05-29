/*
Handles the requests by executing stuff and replying to the client. Uses promises to get stuff done.
*/

'use strict';

const boom = require('boom'), //Boom gives us some predefined http codes and proper responses
  co = require('../common'),
  userCtrl = require('../database/user'),
  usergroupCtrl = require('../database/usergroup'),
  config = require('../configuration'),
  jwt = require('./jwt'),
  Joi = require('joi'),
  JSSHA = require('js-sha512'),
  SMTPConnection = require('smtp-connection'),
  util = require('./util'),
  request = require('request');

module.exports = {
  register: (req, res) => {
    let user = {
      surname:  util.parseAPIParameter(req.payload.surname),
      forename: util.parseAPIParameter(req.payload.forename),
      username: util.parseAPIParameter(req.payload.username).replace(/\s/g,''),
      email:    util.parseAPIParameter(req.payload.email).toLowerCase(),
      password: util.parseAPIParameter(req.payload.password),
      password: co.hashPassword(util.parseAPIParameter(req.payload.password), config.SALT),
      frontendLanguage: util.parseAPIParameter(req.payload.language),
      country: '',
      picture: '',
      description: '',
      organization: util.parseAPIParameter(req.payload.organization),
      registered: (new Date()).toISOString(),
      providers: []
    };

    //check if username already exists
    return util.isIdentityAssigned(user.email, user.username)
      .then((result) => {
        console.log('identity already taken: ', user.email, user.username, result);
        if (result.assigned === false) {
          //TODO: check email

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
                  userid: result.insertedId
                });
              }

              res(boom.badImplementation());
            })
            .catch((error) => {
              console.log('Error on creating a user:', error);
              res(boom.badImplementation('Error', error));
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

  login: (req, res) => {
    const query = {
      $and: [
        {
          email: new RegExp(req.payload.email, 'i')
        },
        {
          $where: 'this.email.length === ' + req.payload.email.length
        }
      ],
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

            res({
              userid: result[0]._id,
              username: result[0].username,
              picture: result[0].picture,
              access_token: 'dummy',
              expires_in: 0
            })
              .header(config.JWT.HEADER, jwt.createToken({
                userid: result[0]._id,
                username: result[0].username
              }));
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
        //console.log('getUser: got user:', user);
        if (user !== undefined && user !== null && user.username !== undefined) {
          if (user.deactivated === true) {
            return res(boom.locked('This user is deactivated.'));
          }

          //get groups of a user
          return usergroupCtrl.readGroupsOfUser(req.params.id)
            .then((array) => {
              user.groups = array;

              return res(prepareDetailedUserData(user));
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
            break;
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
    let email = req.payload.email;
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
            email:       email.toLowerCase(),
            username:    util.parseAPIParameter(req.payload.username).replace(/\s/g,''),
            surname:     util.parseAPIParameter(req.payload.surname),
            forename:    util.parseAPIParameter(req.payload.forename),
            frontendLanguage:    util.parseAPIParameter(req.payload.language),
            country:     util.parseAPIParameter(req.payload.country),
            picture:     util.parseAPIParameter(req.payload.picture),
            description: util.parseAPIParameter(req.payload.description),
            organization: util.parseAPIParameter(req.payload.organization)
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

        if (email.toLowerCase() === oldEMail.toLowerCase()) {
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
        console.log('handler: updateUserProfile: Error while getting user', error1, 'the user is:', user);

        const error = boom.badImplementation('Unknown error');

        error.output.payload.custom = error1;

        return res(error);
      });
  },

  getPublicUser: (req, res) => {
    let identifier = decodeURI(req.params.identifier).replace(/\s/g,'');
    let query = {};
    const integerSchema = Joi.number().integer();
    const validationResult = integerSchema.validate(identifier);
    if (validationResult.error === null) {
      query._id = validationResult.value;
    }
    else {
      query.username = identifier;
    }

    return userCtrl.find(query)
      .then((cursor) => cursor.toArray())
      .then((array) => {
        // console.log('handler: getPublicUser: ', query, array);

        if (array.length === 0)
          return res(boom.notFound());
        if (array.length > 1)
          return res(boom.badImplementation());

        if (array[0].deactivated === true) {
          return res(boom.locked('This user is deactivated.'));
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

    const username = decodeURI(req.params.username).replace(/\s/g,'');
    return userCtrl.find({
      $and: [
        {
          username: new RegExp(username, 'i')
        },
        {
          $where: 'this.username.length === ' + username.length
        }
      ]
    })
      .then((cursor) => cursor.count())
      .then((count) => {
        //console.log('checkUsername: username:', username, '  cursor.count():', count);
        if (count === 0) {
          return res({taken: false, alsoTaken: []});
        }

        const query = {
          username: new RegExp(username.replace(/\s/g,'') + '*', 'i')
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
            }, []);
            return res({taken: true, alsoTaken: alreadyTaken});
          });
      })
      .catch((error) => {
        console.log('handler: checkUsername: error', error);
        res(boom.badImplementation(error));
      });
  },

  searchUser: (req, res) => {
    const username = decodeURI(req.params.username).replace(/\s/g,'');

    const query = {
      username: new RegExp(username.replace(/\s/g,'') + '*', 'i'),
      deactivated:{
        $not: {
          $eq: true
        }
      }
    };
    console.log('query:', query);

    return userCtrl.find(query)
      .then((cursor1) => cursor1.project({username: 1, _id: 1, picture: 1, country: 1, organization: 1}))
      .then((cursor2) => cursor2.limit(10))
      .then((cursor3) => cursor3.toArray())
      .then((array) => {
        // console.log('handler: checkUsername: similar usernames', array);
        let data = array.reduce((prev, curr) => {
          let description = curr.username;
          if (curr.organization)
            description = description + ', ' + curr.organization;
          if (curr.country)
            description = description + ', ' + curr.country;
          prev.push({
            name: description,
            value: encodeURIComponent(JSON.stringify({
              userid: curr._id,
              picture: curr.picture,
              country: curr.country,
              organization: curr.organization,
              username: curr.username
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
    const email = decodeURI(req.params.email).replace(/\s/g,'');

    return userCtrl.find({
      email: new RegExp(email, 'i')
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
    const email = req.payload.email;
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

      let connectionPromise = new Promise((resolve, reject) => {
        //send email before changing data on MongoDB
        let connection;
        try {
          connection = new SMTPConnection({
            host: config.SMTP.host,
            port: config.SMTP.port,
            name: config.SMTP.clientName,
            connectionTimeout: 4000
          });
        }
        catch (e) {
          console.log(e);
          return reject(boom.badImplementation('Wrong SMTP configuration'));
        }

        connection.on('error', (err) => {
          console.log('ERROR on SMTP Client:', err);
          return reject(err);
        });

        connection.connect((result) => {
          //Result of connected event
          console.log('Connection established with result', result, 'and connection details (options, secureConnection, alreadySecured, authenticated)', connection.options, connection.secureConnection, connection.alreadySecured, connection.authenticated);

          //TODO handle different languages

          connection.send({
            from: config.SMTP.from,
            to: email.toLowerCase()
          },
          'Dear SlideWiki user, We changed your password because someone did a request in order to do this. The new password is: ' + newPassword + '   Please login with this password. Thanks SlideWiki team',
          (err, info) => {
            console.log('tried to send the email:', err, info);

            try {
              connection.quit();
            }
            catch (e) {
              console.log('SMTP connection quit failed:', e);
            }

            if (err !== null) {
              return reject(boom.badImplementation(err));
            }

            //handle info object
            if (info.rejected.length > 0) {
              return reject(boom.badImplementation('Email was rejected'));
            }

            resolve({email: email, message: info.response});
          });
        });
      });

      return connectionPromise
      .then((data) => {
        console.log('connectionPromise returned', data);

        //change password in the database
        const findQuery = {
          email: new RegExp(data.email, 'i')
        };
        const updateQuery = {
          $set: {
            password: hashedPassword
          }
        };
        return userCtrl.partlyUpdate(findQuery, updateQuery)
          .then((result) => {
            console.log('handler: resetPassword:',  result.result);

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
      .catch((error) => res(error));
    });
  },

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

    group.creator = {
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

      return usergroupCtrl.create(group)
        .then((result) => {
          // console.log('createOrUpdateUsergroup: created group', result.result || result);

          if (result[0] !== undefined && result[0] !== null) {
            //Error
            return res(boom.badData('Wrong data: ', co.parseAjvValidationErrors(result)));
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
      return res(boom.badData());
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
          if (dCreator !== group.creator.userid) {
            return res(boom.unauthorized());
          }

          //some attribute should be unchangeable
          group.timestamp = document.timestamp;
          group._id = document._id;

          return usergroupCtrl.update(group)
            .then((result) => {
              // console.log('createOrUpdateUsergroup: updated group', result.result || result);

              if (result[0] !== undefined && result[0] !== null) {
                //Error
                return res(boom.badData('Wrong data: ', co.parseAjvValidationErrors(result)));
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
          return res([]);
        }

        let publicUsers = array.reduce((array, user) => {
          array.push(preparePublicUserData(user));
          return array;
        }, []);
        return res(publicUsers);
      });
  }
};

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
      $and: [
        {
          email: new RegExp(email, 'i')
        },
        {
          $where: 'this.email.length === ' + email.length
        }
      ]
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
  const shownKeys = ['_id', 'username', 'organization', 'picture', 'description', 'country'];
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

//Uses userids of creator and members in order to add username and picture
function enrichGroupMembers(group) {
  let userids = group.members.reduce((prev, curr) => {
    prev.push(curr.userid);
    return prev;
  }, []);
  userids.push(group.creator.userid);

  console.log('enrichGroupMembers: group, userids', group, userids);

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
        return user.userid === group.creator.userid;
      });
      let members = array.filter((user) => {
        return user.userid !== group.creator.userid;
      });

      console.log('enrichGroupMembers: got creator and users (amount)', {id: creator[0]._id, name: creator[0].username, email: creator[0].email}, members.concat(group.members).length);

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
        }
        else
          prev[curr.userid].joined = curr.joined;
        return prev;
      }, {});
      members = Object.keys(members).map((key) => { return members[key]; }).filter((member) => {return member.joined && member.userid && member.username;});

      group.creator = creator[0];
      group.members = members;

      console.log('enrichGroupMembers: got new members (after reading from database, adding joined attribute and cleanup), amount:', members.length);

      return group;
    });
}
