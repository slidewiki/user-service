// example unit tests
'use strict';

//Mocking is missing completely TODO add mocked objects

describe('User service', () => {

  let handler, expect;

  beforeEach((done) => {
    //Clean everything up before doing new tests
    Object.keys(require.cache).forEach((key) => delete require.cache[key]);
    require('chai').should();
    let chai = require('chai');
    let chaiAsPromised = require('chai-as-promised');
    chai.use(chaiAsPromised);
    expect = require('chai').expect;
    handler = require('../controllers/handler.js');
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
  let userid = '',
    jwt = '';

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
    });it('Register a second user with same username - should not be possible', () => {
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
    // it('Login with user', () => {
    //   let req = {
    //     payload: {
    //       email: correct_user1.email,
    //       password: correct_user1.password
    //     }
    //   };
    //   return handler.login(req, (result) => {
    //     //console.log('result', result);
    //
    //     expect(result.userid).to.equal(userid);
    //     expect(result.username).to.not.equal(undefined);
    //
    //     return {
    //       header: (name, data) => {
    //         console.log('got header:', name, data);
    //         jwt = data;
    //       }
    //     };
    //   })
    //   .catch((Error) => {
    //     console.log('Error', Error);
    //     throw Error;
    //     expect(1).to.equals(2);
    //   });
    // });
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
        //console.log('testresult: ', result);

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
  });
});
