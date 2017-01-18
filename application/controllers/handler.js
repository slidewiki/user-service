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
  request = require('request');

module.exports = {
  register: (req, res) => {
    let user = {
      surname:  parseAPIParameter(req.payload.surname),
      forename: parseAPIParameter(req.payload.forename),
      username: parseAPIParameter(req.payload.username),
      email:    parseAPIParameter(req.payload.email),
      password: parseAPIParameter(req.payload.password),
      frontendLanguage: parseAPIParameter(req.payload.language),
      country: '',
      picture: '',
      description: '',
      organization: parseAPIParameter(req.payload.organization),
      registered: (new Date()).toISOString()
    };
    console.log('Registration: ', user);

    //check if username already exists
    return isIdentityAssigned(user.email, user.username)
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
              console.log('register: catch: ', error);
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
        res(boom.badImplementation('Error', error));
      });
  },

  login: (req, res) => {
    const query = {
      email: decodeURI(req.payload.email),
      password: decodeURI(req.payload.password)
    };

    return userCtrl.find(query)
      .then((cursor) => cursor.toArray())
      .then((result) => {
        //console.log('login: result: ', result);

        switch (result.length) {
          case 0:
            res(boom.notFound('The credentials are wrong', '{"email":"", "password": ""}'));
            break;
          case 1:
            //TODO: call authorization service for OAuth2 token

            if (result[0].deactivated === true) {
              res(boom.locked('This user is deactivated.'));
              break;
            }

            res({
              userid: result[0]._id,
              username: result[0].username,
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
        res(boom.badImplementation(error));
      });
  },

  getUser: (req, res) => {
    //check if the request comes from the right user (have the right JWT data)
    const isUseridMatching = isJWTValidForTheGivenUserId(req);
    if (!isUseridMatching) {
      return res(boom.forbidden('You cannot get detailed information about another user'));
    }

    return userCtrl.read(parseStringToInteger(req.params.id))
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
        console.log('getUser: error', error);
        res(boom.notFound('Wrong user id', error));
      });
  },

  //add attribute "deactivated" to user document
  deleteUser: (req, res) => {
    let userid = parseStringToInteger(req.params.id);

    //check if the user which should be deleted have the right JWT data
    const isUseridMatching = isJWTValidForTheGivenUserId(req);
    if (!isUseridMatching) {
      return res(boom.unauthorized('You cannot delete another user'));
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
        return res(boom.badImplementation('Deletion failed', error));
      });
  },

  //User profile
  updateUserPasswd: (req, res) => {
    let oldPassword = req.payload.oldPassword;
    let newPassword = req.payload.newPassword;
    const user__id = parseStringToInteger(req.params.id);

    //check if the user which should be updated have the right JWT data
    const isUseridMatching = isJWTValidForTheGivenUserId(req);
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
                res(boom.badImplementation('Update failed', error));
              });
            break;
          default:
            //should not happen
            res(boom.badImplementation('Found multiple users'));
            break;
        }
      });
  },

  updateUserProfile: (req, res) => {
    let user = req.payload;
    user._id = parseStringToInteger(req.params.id);

    //check if the user which should be updated have the right JWT data
    const isUseridMatching = isJWTValidForTheGivenUserId(req);
    if (!isUseridMatching) {
      return res(boom.unauthorized('You cannot change the user profile of another user'));
    }

    console.log('updateUserProfile: use user', user);

    let updateCall = function() {
      const findQuery = {
          _id: user._id
        },
        updateQuery = {
          $set: {
            email:       parseAPIParameter(req.payload.email),
            username:    parseAPIParameter(req.payload.username),
            surname:     parseAPIParameter(req.payload.surname),
            forename:    parseAPIParameter(req.payload.forename),
            frontendLanguage:    parseAPIParameter(req.payload.language),
            country:     parseAPIParameter(req.payload.country),
            picture:     parseAPIParameter(req.payload.picture),
            description: parseAPIParameter(req.payload.description),
            organization: parseAPIParameter(req.payload.organization)
          }
        };

      return userCtrl.partlyUpdate(findQuery, updateQuery)
        .then((result) => {
          console.log('handler: updateUserProfile: updateCall:', updateQuery,  result.result);
          if (result.result.ok === 1 && result.result.n === 1) {
            //success
            return res();
          }

          return res(boom.badImplementation());
        })
        .catch((error) => {
          return res(boom.notFound('Profile update failed', error));
        });
    };

    //find user and check if username has changed
    return userCtrl.find({_id: user._id})
      .then((cursor) => cursor.project({username: 1, email: 1}))
      .then((cursor2) => cursor2.next())
      .then((document) => {
        console.log('handler: updateUserProfile: got user as document', document);

        if (document === null)
          return res(boom.notFound('No user with the given id'));

        const oldUsername = document.username,
          oldEMail = document.email;

        if (decodeURI(req.payload.username) !== oldUsername) {
          return res(boom.notAcceptable('username could not be changed!'));
        }

        if (decodeURI(req.payload.email) === oldEMail) {
          return updateCall();
        }
        else {
          //check if email already exists
          return isEMailAlreadyTaken(user.email)
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
        console.log('handler: updateUserProfile: Error while getting user', error1);
        // return res(boom.badImplementation(error));

        const error = boom.badImplementation('Unknown error');

        error.output.payload.custom = error1;

        return res(error);
      });
  },

  getPublicUser: (req, res) => {
    let identifier = decodeURI(req.params.identifier);
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
          return res(boom.unauthorized('This user is deactivated.'));
        }

        res(preparePublicUserData(array[0]));
      })
      .catch((error) => {
        console.log('handler: getPublicUser: Error', error);
        res(boom.notFound('Wrong user identifier?', error));
      });
  },

  checkUsername: (req, res) => {
    const username = decodeURI(req.params.username);

    return userCtrl.find({
      username: username
    })
      .then((cursor) => cursor.count())
      .then((count) => {
        //console.log('checkUsername: username:', username, '  cursor.count():', count);
        if (count === 0) {
          return res({taken: false, alsoTaken: []});
        }

        const query = {
          username: {
            $regex: username
          }
        };

        return userCtrl.find(query)
          .then((cursor1) => cursor1.project({username: 1}))
          .then((cursor2) => cursor2.maxScan(40))
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
    const username = decodeURI(req.params.username);

    const query = {
      username: {
        $regex: username
      }
    };

    return userCtrl.find(query)
      .then((cursor1) => cursor1.project({username: 1, _id: 1}))
      .then((cursor2) => cursor2.maxScan(10))
      .then((cursor3) => cursor3.toArray())
      .then((array) => {
        //console.log('handler: checkUsername: similar usernames', array);
        let data = array.reduce((prev, curr) => {
          prev.push({
            name: curr.username,
            value: curr._id
          });
          return prev;
        }, []);
        return res({success: true, results: data});
      })
      .catch((error) => {
        console.log('handler: searchUser: error', error);
        res({success: false, results: []});
      });
  },

  checkEmail: (req, res) => {
    const email = decodeURI(req.params.email);

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
    const email = req.payload.email;
    const APIKey = req.payload.APIKey;

    if (APIKey !== config.SMTP.APIKey) {
      return res(boom.forbidden('Wrong APIKey was used'));
    }

    console.log('ResetPassword: APIKey is ok');

    return isEMailAlreadyTaken(email)
    .then((isTaken) => {
      console.log('resetPassword: email taken:', isTaken);
      if (!isTaken) {
        return res(boom.notFound('EMail adress is not taken.'));
      }

      const newPassword = require('crypto').randomBytes(9).toString('hex');
      const hashedPassword = JSSHA.sha512(newPassword + config.SMTP.salt);

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
            to: email
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
          email: data.email
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

        if (document.creator !== req.auth.credentials.userid) {
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
              promises.push(notifiyUser(member.userid, 'left', document));
            });
            return Promise.all(promises).then(() => {
              return res();
            }).catch((error) => {
              console.log('error', error);
              //reply(boom.badImplementation());
              //for now always succeed
              return res();
            });
          });
      });
  },

  createOrUpdateUsergroup: (req, res) => {
    const userid = req.auth.credentials.userid;

    let group = req.payload;

    group.creator = userid;
    group.description = parseAPIParameter(group.description);
    group.name = parseAPIParameter(group.name);
    group.timestamp = parseAPIParameter(group.timestamp) || (new Date()).toISOString();

    if (group.isActive !== false)
      group.isActive = true;
    if (group.members === undefined || group.members === null || group.members.length < 0)
      group.members = [];

    if (group.id === undefined || group.id === null) {
      //create
      // console.log('createOrUpdateUsergroup: create group', group);

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
            let promises = [];
            group.members.forEach((member) => {
              promises.push(notifiyUser(member.userid, 'joined', group));
            });
            return Promise.all(promises).then(() => {
              return res(group);
            }).catch((error) => {
              console.log('error', error);
              //reply(boom.badImplementation());
              //for now always succeed
              return res(group);
            });
          }

          res(boom.badImplementation());
        })
        .catch((error) => {
          console.log('Error', error);
          res(boom.badImplementation(error));
        });
    }
    else if (group.id < 1) {
      //error
      return res(boom.badData());
    }
    else {
      //update
      // console.log('createOrUpdateUsergroup: update group', group);

      //first check if user is creator
      return usergroupCtrl.read(group.id)
        .then((document) => {
          if (document === undefined || document === null) {
            return res(boom.notFound());
          }

          if (document.creator !== group.creator) {
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
                    promises.push(notifiyUser(member.userid, 'joined', group));
                });
                document.members.forEach((member) => {
                  if (wasUserDeleted(member.userid))
                    promises.push(notifiyUser(member.userid, 'left', document));
                });
                return Promise.all(promises).then(() => {
                  return res(group);
                }).catch((error) => {
                  console.log('error', error);
                  //reply(boom.badImplementation());
                  //for now always succeed
                  return res(group);
                });
              }

              res(boom.badImplementation());
            });
        })
        .catch((error) => {
          console.log('Error', error);
          res(boom.badImplementation(error));
        });
    }
  },

  getUsergroups: (req, res) => {
    let selectors = req.payload.reduce((q, element) => {
      q.push({_id: element});
      return q;
    }, []);
    let query = {
      $or: selectors
    };

    // console.log('getUsergroups:', query);

    return usergroupCtrl.find(query)
      .then((cursor) => cursor.toArray())
      .then((array) => {
        if (array === undefined || array === null || array.length < 1) {
          return res([]);
        }

        return res(array);
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

function isIdentityAssigned(email, username) {
  let myPromise = new Promise((resolve, reject) => {
    return userCtrl.find({
      $or: [
        {
          username: username
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
          const isEMailAssigned = !(array.reduce((prev, curr) => {
            const sameEMail = curr.email === email;
            return prev && !sameEMail;
          }, true));
          const isUsernameAssigned = !(array.reduce((prev, curr) => {
            const sameUsername = curr.username === username;
            return prev && !sameUsername;
          }, true));

          resolve({
            assigned: isEMailAssigned || isUsernameAssigned,
            username: isUsernameAssigned,
            email: isEMailAssigned
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

//JWT validation inserts userid in header which should be the same as the one in the parameters
function isJWTValidForTheGivenUserId(req) {
  let jwt_userid = '';
  try {
    jwt_userid = req.auth.credentials.userid;
  } catch (e) {}
  //console.log(decodeURI(req.params.id), 'vs', jwt_data);
  if (decodeURI(req.params.id).toString() !== jwt_userid.toString()) {
    return false;
  }
  return true;
}

function parseAPIParameter(parameter) {
  if (parameter === undefined || parameter === null || parameter.replace(' ', '') === '')
    return '';

  return decodeURI(parameter);
}

function parseStringToInteger(string) {
  const integerSchema = Joi.number().integer();
  const validationResult = integerSchema.validate(string);
  if (validationResult.error === null) {
    return validationResult.value;
  }
  return undefined;
}

function notifiyUser(userid, type, group) {
  let promise = new Promise((resolve, reject) => {
    const options = {
      url: config.URLS.notificationservice + '/notification/new',
      method: 'POST',
      json: true,
      body: {
        activity_id: require('crypto').randomBytes(9).toString('hex'),
        activity_type: type,
        user_id: userid.toString(),
        content_id: group._id.toString(),
        content_kind: 'group',
        content_name: 'You ' + type + ' the group ' + group.name,
        content_owner_id: userid.toString(),
        subscribed_user_id: userid.toString()
      }
    };

    function callback(error, response, body) {
      console.log('notifiyUser: ', error, response.statusCode, body);

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
