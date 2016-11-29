// example unit tests
'use strict';

//Mocking is missing completely TODO add mocked objects

describe('User service', () => {

  let handler, handler_social, providerCtrl, expect;

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
    username: 'TBoonX',
    email: 'tboonx@googlemail.com'
  };
  const correct_provider = {
    '_id' : '5811f623679e6d357a076207',
    identifier: '2839748234',
  	'provider' : 'github',
  	'token' : '47a629160532535502fff76f5b6e3513a2a2da9e',
  	'scope' : 'user',
  	'expires' : undefined,
  	'extra_token' : undefined,
  	'token_creation' : now,
  	'username' : 'TBoonX',
  	'email' : 'tboonx@googlemail.com',
  	'id' : '2839748234',
  	'location' : 'Deutschland',
  	'organization' : 'Institut für Angewandte Informatik e. V.',
  	'description' : null,
  	'picture' : 'https://avatars.githubusercontent.com/u/3153545?v=3',
  	'name' : 'Kurt Junghanns'
  };
  const correct_provider2 = {
    'provider' : 'google',
  	'token' : 'wercvrwe78nzc87 ncbr4btc67c7h7c',
  	'scope' : 'user',
  	'expires' : 3600,
  	'extra_token' : undefined,
  	'token_creation' : now,
  	'username' : 'TBoonX',
  	'email' : 'tboonx@googlemail.com',
  	'id' : '453453534534534',
    identifier: '453453534534534',
  	'location' : 'Deutschland',
  	'organization' : 'Institut für Angewandte Informatik e. V.',
  	'description' : null,
  	'picture' : 'https://avatars.githubusercontent.com/u/3153545?v=3',
  	'name' : 'Kurt Junghanns'
  };
  const wrong_provider = {
    'provider' : 'socialface',
  	'token' : 'wercvrwe78nzc87 ncbr4btc67c7h7c',
  	'scope' : 'user',
  	'expires' : 1,
  	'extra_token' : undefined,
  	'token_creation' : now,
  	'username' : 'TBoonX',
  	'email' : 'tboonx@googlemail.com',
  	'id' : '453453534534534',
    identifier: '453453534534534',
  	'location' : 'Deutschland',
  	'organization' : 'Institut für Angewandte Informatik e. V.',
  	'description' : null,
  	'picture' : 'https://avatars.githubusercontent.com/u/3153545?v=3',
  	'name' : 'Kurt Junghanns'
  };
  let correct_usergroup = {
    name: 'Testgroup',
    description: 'Used for Unit tests',
    isActive: true,
    members: [
      {
        userid: 1,
        joined: (new Date()).toISOString(),
        username: 'Rob'
      }
    ]
  };
  let correct_usergroup2 = {
    name: 'Blub blabla blub',
    description: 'Used for Unit tests',
    isActive: true,
    members: [
      {
        userid: 1,
        joined: (new Date()).toISOString(),
        username: 'ASW2'
      },
      {
        userid: 2,
        joined: (new Date()).toISOString(),
        username: 'Rob'
      }
    ]
  };
  let userid = '',
    jwt = '',
    groupid = 0;

  context('Using all exported functions - ', () => {
    it('Register user', () => {
      let req = {
        payload: correct_user1
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
        expect(1).to.equals(2);
      });
    });
    it('Register a second user with same username - should not be possible', () => {
      let req = {
        payload: correct_user1
      };
      return handler.register(req, (result) => {
        //console.log(result);

        expect(result.output).to.not.equal(undefined);
        expect(result.output).to.not.equal(null);
        expect(result.output.statusCode).to.equal(422);

        return;
      })
      .catch((Error) => {
        console.log(Error);
        throw Error;
        expect(1).to.equals(2);
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
        expect(1).to.equals(2);
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
        expect(1).to.equals(2);
      });
    });
    it('Update user profile', () => {
      let req = {
        payload: {
          email: correct_user1.email,
          username: correct_user1.username,
          forename: correct_user1.forename,
          surname: correct_user1.surname
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

          return;
        });
      })
      .catch((Error) => {
        console.log('Error', Error);
        throw Error;
        expect(1).to.equals(2);
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

        return;
      })
      .catch((Error) => {
        console.log('Error', Error);
        throw Error;
        expect(1).to.equals(2);
      });
    });
    it('Update user password', () => {
      let req = {
        payload: {
          oldPassword: 'wrong',
          newPassword: 'ua89nd7s8df7zsb78f'
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
        expect(1).to.equals(2);
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
        expect(1).to.equals(2);
      });
    });


    //usergroups

    it('Create usergroup', () => {
      let req = {
        payload: correct_usergroup,
        auth: { //headers which will be set with JWT
          credentials: {
            userid: userid
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
        expect(1).to.equals(2);
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

        return;
      })
      .catch((Error) => {
        console.log('Error', Error);
        throw Error;
        expect(1).to.equals(2);
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

        return;
      })
      .catch((Error) => {
        console.log('Error', Error);
        throw Error;
        expect(1).to.equals(2);
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
        expect(1).to.equals(2);
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
        expect(1).to.equals(2);
      });
    });

    it('Login with deleted user', () => {
      let req = {
        payload: {
          email: correct_user1.email,
          password: correct_user1.password
        }
      };
      return handler.login(req, (result) => {
        // console.log('result', result);

        expect(result.isBoom).to.equal(true);
        expect(result.output.statusCode).to.equal(401);

        return;
      })
      .catch((Error) => {
        console.log('Error', Error);
        throw Error;
        expect(1).to.equals(2);
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
        // console.log(result);

        expect(result.isBoom).to.equal(true);
        expect(result.output.statusCode).to.equal(401);

        return;
      })
      .catch((Error) => {
        console.log('Error', Error);
        throw Error;
        expect(1).to.equals(2);
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
            expect(1).to.equals(2);
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
        expect(1).to.equals(2);
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
            expect(1).to.equals(2);
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
  });
});
