// example unit tests
'use strict';

//Mocking is missing completely TODO add mocked objects

describe('User service', () => {

  let handler, handler_social, providerCtrl, userCtrl, expect;

  beforeEach((done) => {
    //Clean everything up before doing new tests
    Object.keys(require.cache).forEach((key) => delete require.cache[key]);
    require('chai').should();
    let chai = require('chai');
    let chaiAsPromised = require('chai-as-promised');
    chai.use(chaiAsPromised);
    expect = require('chai').expect;
    handler = require('../controllers/handler.js');
    handler_social = require('../controllers/handler_social.js');
    providerCtrl = require('../database/provider.js');
    userCtrl = require('../database/user.js');
    done();
  });

  const correct_user1 = {
    username: 'tboonx',
    forename: 'Kurt',
    surname: 'Junghanns',
    email: 'tboonx@gmail.com',
    password: '234729834782364826348623846284t374t',
    language: 'de',
    defaults: [{
      language: 'de'
    }]
  };
  const now = (new Date()).toISOString();
  const correct_oauth_user = {
    id: '2839748234',
    identifier: '2839748234',
    provider: 'github',
    token: '47a629160532535502fff76f5b6e3513a2a2da9e',
    scope: 'user',
    token_creation: now,//Date
    username: 'TBoonXXX',
    email: 'tboonx@googlemail.com'
  };
  const correct_provider = {
    '_id': '5811f623679e6d357a076207',
    identifier: '2839748234',
    'provider': 'github',
    'token': '47a629160532535502fff76f5b6e3513a2a2da9e',
    'scope': 'user',
    'expires': undefined,
    'extra_token': undefined,
    'token_creation': now,
    'username': 'TBoonX',
    'email': 'tboonx@googlemail.com',
    'id': '2839748234',
    'location': 'Deutschland',
    'organization': 'Institut für Angewandte Informatik e. V.',
    'description': null,
    'picture': 'https://avatars.githubusercontent.com/u/3153545?v=3',
    'name': 'Kurt Junghanns'
  };
  const correct_provider2 = {
    'provider': 'google',
    'token': 'wercvrwe78nzc87 ncbr4btc67c7h7c',
    'scope': 'user',
    'expires': 3600,
    'extra_token': undefined,
    'token_creation': now,
    'username': 'TBoonX',
    'email': 'tboonx@googlemail.com',
    'id': '453453534534534',
    identifier: '453453534534534',
    'location': 'Deutschland',
    'organization': 'Institut für Angewandte Informatik e. V.',
    'description': null,
    'picture': 'https://avatars.githubusercontent.com/u/3153545?v=3',
    'name': 'Kurt Junghanns'
  };
  const wrong_provider = {
    'provider': 'socialface',
    'token': 'wercvrwe78nzc87 ncbr4btc67c7h7c',
    'scope': 'user',
    'expires': 1,
    'extra_token': undefined,
    'token_creation': now,
    'username': 'TBoonX',
    'email': 'tboonx@googlemail.com',
    'id': '453453534534534',
    identifier: '453453534534534',
    'location': 'Deutschland',
    'organization': 'Institut für Angewandte Informatik e. V.',
    'description': null,
    'picture': 'https://avatars.githubusercontent.com/u/3153545?v=3',
    'name': 'Kurt Junghanns'
  };
  let wrong_usergroup = {
    Name: 'Testgroup',
    text: 'Used for Unit tests',
    acive: 1,
    members: [
      {
        username: 'A',
        id: 2
      }
    ]
  };
  let correct_usergroup = {
    name: 'Testgroup',
    description: 'Used for Unit tests',
    isActive: true,
    members: [
      {
        userid: 3,
        joined: (new Date()).toISOString()
      }
    ]
  };
  let correct_usergroup2 = {
    name: 'Blub blabla blub',
    description: 'Used for Unit tests',
    isActive: true,
    members: [
      {
        userid: 3,
        joined: (new Date()).toISOString(),
        role: 'admin'
      }
    ]
  };
  let correct_usergroup3 = {
    name: '!!!',
    description: 'Used for Unit tests again',
    isActive: true,
    members: [
      {
        userid: 5,
        joined: (new Date()).toISOString()
      }
    ]
  };
  let correct_usergroup4 = {
    name: '???',
    description: 'Used for Unit tests again!',
    isActive: true,
    members: [
      {
        userid: 3,
        joined: (new Date()).toISOString(),
        role: 'admin'
      },
      {
        userid: 6,
        joined: (new Date()).toISOString()
      },
      {
        userid: 4,
        joined: (new Date()).toISOString(),
        role: 'admin'
      }
    ],
    picture: 'https://avatars.githubusercontent.com/u/3153545?v=3'
  };

  // this user should be rejected by register function
  const wrong_user1 = {
    username: 'system',
    forename: 'Kostis',
    surname: 'Pristouris',
    email: 'kprist@gmail.com',
    password: '812408917221308476234',
    language: 'el',
    defaults: [{
      language: 'el'
    }]
  };

  const reviewableUser = {
    username: 'Spammer?',
    forename: '2',
    surname: '3',
    email: 'yahoo@gmail.com',
    password: '445435234554654645666456356',
    language: 'en',
    defaults: [{
      language: 'en'
    }]
  };

  const addableUser = {
    username: 'Korrekt',
    forename: '4',
    surname: '5',
    email: 'yahoo2@gmail.com',
    password: '44543523feffff4554654645666456356',
    language: 'en',
    defaults: [{
      language: 'en'
    }]
  };

  const newPassword = 'ua89nd7s8df7zsb78f';
  let userid = '',
    jwt = '',
    groupid = 0,
    suspendedUserId = 0,
    addableUserId = 0;

  context('Using all exported functions - ', () => {
    it('Register user', () => {
      let req = {
        payload: correct_user1,
        info: {
          host: 'localhost'
        }
      };
      return handler.register(req, (result) => {
        console.log(result);

        expect(result.userid).to.not.equal(undefined);

        userid = result.userid;

        return;
      })
        .catch((Error) => {
          console.log(Error);
          throw Error;
        });
    });
    it('Register a second user with same username - should not be possible', () => {
      let req = {
        payload: correct_user1
      };
      return handler.register(req, (result) => {
        console.log(result);

        expect(result.output).to.not.equal(undefined);
        expect(result.output).to.not.equal(null);
        expect(result.output.statusCode).to.equal(409);

        return;
      })
        .catch((Error) => {
          console.log(Error);
          throw Error;
        });
    });
    it('Register a second user with same username with upper case - should not be possible', () => {
      let req = {
        payload: JSON.parse(JSON.stringify(correct_user1))
      };
      req.payload.username = 'TBoonX';
      return handler.register(req, (result) => {
        console.log(result);

        expect(result.output).to.not.equal(undefined);
        expect(result.output).to.not.equal(null);
        expect(result.output.statusCode).to.equal(409);

        return;
      })
        .catch((Error) => {
          console.log(Error);
          throw Error;
        });
    });
    it('Should not allow a user to register with username `system`', () => {
      return handler.register({ payload: wrong_user1 }, (result) => {
        // console.log('testresult', result);
        expect(result).to.be.an('error').that.has.property('isBoom', true);
        expect(result.output).to.not.equal(undefined);
        expect(result.output.statusCode).to.equal(409);
        // expect(result).to.have.deep.property('output.statusCode', 409);
      });
    });
    it('Activate user', () => {
      let req = {
        params: {
          email: correct_user1.email,
          secret: ''
        }
      };
      return userCtrl.find({email: correct_user1.email})
        .then((cursor) => cursor.toArray())
        .then((result) => {
          req.params.secret = result[0].activate_secret;

          return handler.activateUser(req, (result) => {
            return {redirect: (url) => {
              console.log(url);
              expect(url).to.not.equal(undefined);
              return {temporary: () => {
                console.log('redirect did');
                return;
              }};
            }};
          })
            .catch((Error) => {
              console.log('Error', Error);
              throw Error;
            });
        });
    });
    it('Get user public', () => {
      //first with _id
      let req = {
        params: {
          identifier: userid
        }
      };
      return handler.getPublicUser(req, (result) => {
        //console.log(result);

        expect(result._id).to.equal(userid);
        expect(result.username).to.equal(correct_user1.username);

        //now with username
        req.params.identifier = correct_user1.username;

        return handler.getPublicUser(req, (result2) => {
          //console.log(result);

          expect(result2._id).to.equal(userid);
          expect(result2.username).to.equal(correct_user1.username);

          return;
        });
      })
        .catch((Error) => {
          console.log('Error', Error);
          throw Error;
        });
    });
    it('Should return public info for `system` static user', () => {

      return handler.getPublicUser({ params: { identifier: '-1' } }, (result) => {
        // first with id
        expect(result).to.be.an('object');
        expect(result).to.have.property('_id', -1);
        expect(result).to.have.property('username', 'system');

        return handler.getPublicUser({ params: { identifier: 'system' } }, (result) => {
          // then with name
          expect(result).to.be.an('object');
          expect(result).to.have.property('_id', -1);
          expect(result).to.have.property('username', 'system');
        });

      });
    });
    it('Login with user', () => {
      let req = {
        payload: {
          email: correct_user1.email,
          password: correct_user1.password
        }
      };
      return handler.login(req, (result) => {
        //console.log('result', result);

        expect(result.userid).to.equal(userid);
        expect(result.username).to.not.equal(undefined);

        return {
          header: (name, data) => {
            console.log('got header:', name, data);
            jwt = data;
          }
        };
      })
        .catch((Error) => {
          console.log('Error', Error);
          throw Error;
        });
    });
    it('Update user profile', () => {
      let req = {
        payload: {
          email: correct_user1.email,
          username: correct_user1.username,
          forename: correct_user1.forename + ' von',
          surname: correct_user1.surname,
          displayName: 'XXX'
        },
        params: {
          id: userid
        },
        auth: { //headers which will be set with JWT
          credentials: {
            userid: userid
          }
        }
      };
      return handler.updateUserProfile(req, (result) => {
        // console.log('testresult', result);

        //should be possible (updates fields)
        expect(result).to.equal(undefined);

        //again with other username
        req.payload.email = 'Bazingaish' + req.payload.email;

        return handler.updateUserProfile(req, (result2) => {
          // console.log('testresult2', result2);

          //updates username
          expect(result2).to.equal(undefined);

          //check if changes were applied
          let req = {
            params: {
              identifier: userid
            }
          };
          return handler.getPublicUser(req, (result) => {
            //console.log(result);

            expect(result._id).to.equal(userid);
            expect(result.username).to.equal(correct_user1.username);

            //now with username
            req.params.identifier = correct_user1.username;

            return handler.getPublicUser(req, (result2) => {
              //console.log(result);

              expect(result2._id).to.equal(userid);
              expect(result2.displayName).to.equal('XXX');

              return;
            });
          })
            .catch((Error) => {
              console.log('Error', Error);
              throw Error;
            });
        });
      })
        .catch((Error) => {
          console.log('Error', Error);
          throw Error;
        });
    });
    it('Get user detailed', () => {
      let req = {
        params: {
          id: userid
        },
        auth: { //headers which will be set with JWT
          credentials: {
            userid: userid
          }
        }
      };
      return handler.getUser(req, (result) => {
        console.log('testresult: detailed user', result);

        expect(result._id).to.equal(userid);
        expect(result.password).to.equal(undefined);

        return {
          header: (name, data) => {
            jwt = data;
          }
        };
      })
        .catch((Error) => {
          console.log('Error', Error);
          throw Error;
        });
    });
    it('Update user password', () => {
      let req = {
        payload: {
          oldPassword: 'wrong',
          newPassword: newPassword
        },
        params: {
          id: userid
        },
        auth: { //headers which will be set with JWT
          credentials: {
            userid: userid
          }
        }
      };
      return handler.updateUserPasswd(req, (result) => {
        //console.log('testresult: ', result);

        //should failed
        expect(result).to.not.equal(undefined);
        expect(result.isBoom).to.equal(true);
        expect(result.output.statusCode).to.equal(404);

        //again with correct password
        req.payload.oldPassword = correct_user1.password;

        return handler.updateUserPasswd(req, (result2) => {
          //console.log('testresult: ', result2);

          expect(result2).to.equal(undefined);
          //expect(result2.isBoom).to.not.equal(true);

          return;
        });
      })
        .catch((Error) => {
          console.log('Error', Error);
          throw Error;
        });
    });
    it('Check usernames', () => {
      let req = {
        params: {
          username: 'foobarr3io4v5nzoi'
        }
      };
      return handler.checkUsername(req, (result) => {
        //console.log('testresult1: ', result);

        //should not be taken
        expect(result).to.not.equal(undefined);
        expect(result.taken).to.equal(false);
        expect(result.alsoTaken.length).to.equal(0);

        //again with similar username
        req.params.username = correct_user1.username.substring(0,3);

        return handler.checkUsername(req, (result2) => {
          //console.log('testresult2: ', result2);

          expect(result2).to.not.equal(undefined);
          expect(result2.taken).to.equal(false);
          expect(result2.alsoTaken.length).to.equal(0);

          //again with existing username
          req.params.username = correct_user1.username;

          return handler.checkUsername(req, (result3) => {
            //console.log('testresult3: ', result3);

            expect(result3).to.not.equal(undefined);
            expect(result3.taken).to.equal(true);
            expect(result3.alsoTaken.length).to.not.equal(0);

            return;
          });
        });
      })
        .catch((Error) => {
          console.log('Error', Error);
          throw Error;
        });
    });
    it('Should check `system` username and report it as taken', () => {
      return handler.checkUsername({ params: { username: 'system' } }, (result) => {
        // should be taken
        expect(result).to.be.an('object').that.has.property('taken', true);
        expect(result.alsoTaken).to.be.an('array').that.is.not.empty;
      });
    });


    //usergroups

    it('Try to create wrong usergroup', function(done) {
      let req = {
        payload: wrong_usergroup,
        auth: { //headers which will be set with JWT
          credentials: {
            userid: userid
          }
        }
      };
      handler.createOrUpdateUsergroup(req, (result) => {
        console.log(result);
        let error = undefined;

        try {
          expect(result).to.not.equal(undefined);
          expect(result.isBoom).to.equal(true);
          expect(result.output).to.not.equal(undefined);
          expect(result.output.statusCode).to.equal(422);
        } catch (e) {
          error = e;
        }

        done(error);
      });
    }).timeout(60000);
    it('Create usergroup', () => {
      let req = {
        payload: correct_usergroup,
        auth: { //headers which will be set with JWT
          credentials: {
            userid: userid,
            username: 'tboonx'
          }
        }
      };
      return handler.createOrUpdateUsergroup(req, (result) => {
        // console.log(result);

        expect(result.name).to.equal(correct_usergroup.name);

        groupid = result.id;

        return;
      })
        .catch((Error) => {
          console.log('Error', Error);
          throw Error;
        });
    }).timeout(60000);
    it('Update usergroup', () => {
      let group = correct_usergroup2;
      group.id = groupid;
      let req = {
        payload: group,
        auth: { //headers which will be set with JWT
          credentials: {
            userid: userid
          }
        }
      };
      return handler.createOrUpdateUsergroup(req, (result) => {
        // console.log(result);

        expect(result.name).to.equal('Blub blabla blub');
        expect(result.picture).to.equal(correct_usergroup2.picture);

        return;
      })
        .catch((Error) => {
          console.log('Error', Error);
          throw Error;
        });
    }).timeout(60000);
    it('Update usergroup as admin', () => {
      let group = correct_usergroup3;
      group.id = groupid;
      let req = {
        payload: group,
        auth: { //headers which will be set with JWT
          credentials: {
            userid: correct_usergroup2.members[0].userid
          }
        }
      };
      return handler.createOrUpdateUsergroup(req, (result) => {
        // console.log(result);

        expect(result.name).to.equal('!!!');

        return;
      })
        .catch((Error) => {
          console.log('Error', Error);
          throw Error;
        });
    }).timeout(60000);
    it('Try to update usergroup as a not admin', () => {
      let group = correct_usergroup4;
      group.id = groupid;
      let req = {
        payload: group,
        auth: { //headers which will be set with JWT
          credentials: {
            userid: correct_usergroup2.members[0].userid
          }
        }
      };
      return handler.createOrUpdateUsergroup(req, (result) => {
        // console.log(result);

        expect(result.isBoom).to.equal(true);
        expect(result.output.statusCode).to.equal(401);

        return;
      })
        .catch((Error) => {
          console.log('Error', Error);
          throw Error;
        });
    }).timeout(60000);
    it('Get user detailed and check groups', () => {
      let req = {
        params: {
          id: userid
        },
        auth: { //headers which will be set with JWT
          credentials: {
            userid: userid
          }
        }
      };
      return handler.getUser(req, (result) => {
        // console.log('testresult: ', result);

        expect(result._id).to.equal(userid);
        expect(result.groups).to.not.equal(undefined);
        expect(result.groups.length).to.equal(1);
        expect(result.groups[0].id).to.equal(groupid);

        return {
          header: (name, data) => {
            jwt = data;
          }
        };
      })
        .catch((Error) => {
          console.log('Error', Error);
          throw Error;
        });
    }).timeout(60000);
    it('Get user as service', () => {
      let req = {
        auth: { //headers which will be set with JWT
          credentials: {
            userid: userid
          }
        }
      };
      return handler.getUserdata(req, (result) => {
        // console.log('testresult: ', result);

        expect(result.id).to.equal(userid);
        expect(result.email).to.not.equal('');
        expect(result.groups).to.not.equal(undefined);
        expect(result.groups.length).to.equal(1);
        expect(result.groups[0].id).to.equal(groupid);

        return;
      })
        .catch((Error) => {
          console.log('Error', Error);
          throw Error;
        });
    }).timeout(60000);
    it('Get usergroup', function(done) {
      let req = {
        payload: [groupid]
      };
      handler.getUsergroups(req, (result) => {
        console.log('testresult: ', result, result.members);
        let error = undefined;

        try {
          expect(result[0]).to.not.equal(undefined);
          expect(result[0].creator.userid).to.equal(userid);
          expect(result[0].creator.username).to.not.equal(undefined);
          expect(result[0].members.length).to.equal(1);
        } catch (e) {
          error = e;
        }

        done(error);
      });
    }).timeout(60000);
    it('Delete usergroup', () => {
      let req = {
        params: {
          groupid: groupid
        },
        auth: { //headers which will be set with JWT
          credentials: {
            userid: userid
          }
        }
      };
      return handler.deleteUsergroup(req, (result) => {
        console.log(result);

        expect(result).to.equal(undefined);

        return;
      })
        .catch((Error) => {
          console.log('Error', Error);
          throw Error;
        });
    }).timeout(60000);

    //delete the user

    it('Delete user', () => {
      let req = {
        params: {
          id: userid
        },
        auth: { //headers which will be set with JWT
          credentials: {
            userid: userid
          }
        }
      };
      return handler.deleteUser(req, (result) => {
        console.log('result', result);

        expect(result).to.equal(undefined);

        return;
      })
        .catch((Error) => {
          console.log('Error', Error);
          throw Error;
        });
    });

    it('Login with deleted user', () => {
      let req = {
        payload: {
          email: 'Bazingaish' + correct_user1.email,
          password: newPassword
        }
      };
      return handler.login(req, (result) => {
        console.log('result', result);

        expect(result.isBoom).to.equal(true);
        expect(result.output.statusCode).to.equal(423);

        return;
      })
        .catch((Error) => {
          console.log('Error', Error);
          throw Error;
        });
    });
    it('Get deleted user as public', () => {
      //first with _id
      let req = {
        params: {
          identifier: userid
        }
      };
      return handler.getPublicUser(req, (result) => {
        console.log(result);

        expect(result.isBoom).to.equal(true);
        expect(result.output.statusCode).to.equal(423);

        return;
      })
        .catch((Error) => {
          console.log('Error', Error);
          throw Error;
        });
    });

    //Social login stuff

    it('Register user with OAuth data', () => {
      //first create provider in db
      return providerCtrl.create(correct_provider)
        .then((insert_result) => {
          // console.log('insert_result', insert_result);

          expect(insert_result.insertedCount).to.equal(1);

          let req = {
            payload: correct_oauth_user
          };
          return handler_social.registerWithOAuth(req, (result) => {
            console.log(result);

            expect(result.userid).to.not.equal(undefined);

            userid = result.userid;

            return {
              header: (name, data) => {
                console.log('got header:', name, data);
                jwt = data;
              }
            };
          })
            .catch((Error) => {
              console.log(Error);
              throw Error;
            });
        });
    });
    it('Login with oauth', () => {
      let req = {
        payload: correct_oauth_user
      };
      return handler_social.loginWithOAuth(req, (result) => {
        // console.log('result', result);

        expect(result.userid).to.equal(userid);
        expect(result.username).to.not.equal(undefined);

        userid = result.userid;

        return {
          header: (name, data) => {
            console.log('got header:', name, data);
            jwt = data;
          }
        };
      })
        .catch((Error) => {
          console.log('Error', Error);
          throw Error;
        });
    });
    it('Add provider', () => {
      //first create provider in db
      return providerCtrl.create(correct_provider2)
        .then((insert_result) => {
          // console.log('insert_result', insert_result);

          expect(insert_result.insertedCount).to.equal(1);

          let req = {
            payload: correct_provider2,
            auth: { //headers which will be set with JWT
              credentials: {
                userid: userid
              }
            }
          };
          return handler_social.addProvider(req, (result) => {
            // console.log('result', result);

            expect(result).to.equal(undefined);

            return;
          })
            .catch((Error) => {
              console.log('Error', Error);
              throw Error;
            });
        });
    });
    it('Try add wrong provider', () => {
      //first create provider in db
      return providerCtrl.create(wrong_provider)
        .then((insert_result) => {
          // console.log('insert_result', insert_result);

          expect(insert_result.insertedCount).to.equal(1);

          let req = {
            payload: wrong_provider,
            auth: { //headers which will be set with JWT
              credentials: {
                userid: userid
              }
            }
          };
          return handler_social.addProvider(req, (result) => {
            // console.log('result', result);

            expect(result).to.not.equal(undefined);
            expect(result.isBoom).to.equal(true);
            expect(result.output.statusCode).to.equal(406);

            return;
          });
        });
    });
    it('list all providers of a user', () => {
      let req = {
        params: {
          id: userid
        },
        auth: { //headers which will be set with JWT
          credentials: {
            userid: userid
          }
        }
      };
      return handler_social.getProvidersOfUser(req, (result) => {
        // console.log('result', result);

        expect(result.length).to.equal(2);

        return;
      });
    });
    it('Delete provider', () => {
      let req = {
        params: {
          provider: 'google'
        },
        auth: { //headers which will be set with JWT
          credentials: {
            userid: userid
          }
        }
      };
      return handler_social.deleteProvider(req, (result) => {
        // console.log('result', result);

        expect(result).to.equal(undefined);
        return;
      });
    });

    // SPAM protection functions

    it('Get reviewable users', function(done) {
      let req = {
        params: {
        },
        auth: { //headers which will be set with JWT
          credentials: {
            userid: userid
          }
        }
      };
      handler.getReviewableUsers(req, (result) => {
        console.log('result', result);
        let error = undefined;

        try {
          expect(result).to.not.equal(undefined);
          expect(result.length).to.equal(2);
          expect(result[0]).to.not.equal(undefined);
          expect(result[0].userid).to.not.equal(undefined);
          expect(result[0].username).to.not.equal(undefined);
        } catch (e) {
          error = e;
        }
        done(error);
      });
    });

    it('try to suspend a user without secret', () => {
      let req = {
        params: {
          id: 1
        },
        auth: { //headers which will be set with JWT
          credentials: {
            userid: userid,
            isReviewer: true
          }
        }
      };
      return handler.suspendUser(req, (result) => {
        // console.log('result', result);

        expect(result).to.not.equal(undefined);
        expect(result.isBoom).to.equal(true);
        expect(result.output.statusCode).to.equal(401);
        return;
      });
    });

    it('try to suspend a user without isReviewer=true in JWT', () => {
      let req = {
        params: {
          id: 1
        },
        auth: { //headers which will be set with JWT
          credentials: {
            userid: userid
          }
        },
        query: {
          secret: 'test'
        }
      };
      return handler.suspendUser(req, (result) => {
        // console.log('result', result);

        expect(result).to.not.equal(undefined);
        expect(result.isBoom).to.equal(true);
        expect(result.output.statusCode).to.equal(403);
        return;
      });
    });

    it('Prepare suspendabe user', () => {
      //First register a user
      let req = {
        payload: reviewableUser,
        info: {
          host: 'localhost'
        }
      };
      return handler.register(req, (result) => {
        expect(result.userid).to.not.equal(undefined);

        let rU = result.userid;
        suspendedUserId = rU;
        console.log('user created', rU);
        //Now activate the new user
        req = {
          params: {
            email: reviewableUser.email,
            secret: ''
          }
        };
        return userCtrl.find({email: reviewableUser.email})
          .then((cursor) => cursor.toArray())
          .then((result) => {
            req.params.secret = result[0].activate_secret;

            return handler.activateUser(req, (result) => {
              return {redirect: (url) => {
                expect(url).to.not.equal(undefined);
                console.log('User activated!');
                return {temporary: (bool) => {
                  expect(bool).to.equal(true);
                  return;
                }};
              }};
            })
              .catch((Error) => {
                console.log('Error', Error);
                throw Error;
              });
          });
      })
        .catch((Error) => {
          console.log(Error);
          throw Error;
        });
    });

    it('Suspend a user with secret and correct JWT', () => {
      let req = {
        params: {
          id: suspendedUserId
        },
        auth: { //headers which will be set with JWT
          credentials: {
            userid: userid,
            isReviewer: true
          }
        },
        query: {
          secret: 'test'
        }
      };
      process.env.SECRET_REVIEW_KEY = 'test';
      console.log('now suspending ...');
      return handler.suspendUser(req, (result3) => {
        console.log('result', result3);

        expect(result3).to.equal(undefined);
        console.log('Finished');
        // now check if public user profile couldnt get
        req = {
          params: {
            identifier: suspendedUserId
          }
        };
        return handler.getPublicUser(req, (result) => {
          console.log('public user', result);

          expect(result).to.not.equal(undefined);
          expect(result._id).to.equal(suspendedUserId);

          return;
        })
          .catch((Error) => {
            console.log('Error', Error);
            throw Error;
          });
      });
    });

    it('Prepare addable user', () => {
      //First register a user
      let req = {
        payload: addableUser,
        info: {
          host: 'localhost'
        }
      };
      return handler.register(req, (result) => {
        expect(result.userid).to.not.equal(undefined);

        let rU = result.userid;
        addableUserId = rU;
        console.log('user created', rU);
        //Now activate the new user
        req = {
          params: {
            email: addableUser.email,
            secret: ''
          }
        };
        return userCtrl.find({email: addableUser.email})
          .then((cursor) => cursor.toArray())
          .then((result) => {
            req.params.secret = result[0].activate_secret;

            return handler.activateUser(req, (result) => {
              return {redirect: (url) => {
                expect(url).to.not.equal(undefined);
                console.log('User activated!');
                return {temporary: (bool) => {
                  expect(bool).to.equal(true);
                  return;
                }};
              }};
            })
              .catch((Error) => {
                console.log('Error', Error);
                throw Error;
              });
          });
      })
        .catch((Error) => {
          console.log(Error);
          throw Error;
        });
    });

    it('Add user to queue', () => {
      let req = {
        params: {
          id: addableUserId
        },
        auth: { //headers which will be set with JWT
          credentials: {
            userid: userid,
            isReviewer: true
          }
        },
        query: {
          secret: 'test',
          decks: 12
        }
      };
      process.env.SECRET_REVIEW_KEY = 'test';
      console.log('now adding user to queue ...');
      return handler.addToQueue(req, (result) => {
        console.log('testresult', result);

        expect(result).to.equal(undefined);

        return true;
      });
    });
  });
});
