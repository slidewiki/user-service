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
    languages: ['de'],
    defaults: [{
      language: 'de'
    }],
    registered: false
  };
  let userid = '';

  context('Using all exported functions - ', () => {
    it('Register user', () => {
      let req = {
        payload: correct_user1
      };
      return handler.register(req, (result) => {
        //console.log(result);

        expect(result.success).to.equal(true);
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
    it('Get user', () => {
      let req = {
        params: {
          id: userid
        }
      };
      return handler.getUser(req, (result) => {
        //console.log(result);

        expect(result._id.toString()).to.equal(userid.toString());

        return;
      })
      .catch((Error) => {
        console.log(Error);
        throw Error;
        expect(1).to.equals(2);
      });
    });
    it('Login with user', () => {
      let req = {
        payload: {
          username: correct_user1.username,
          password: correct_user1.password
        }
      };
      return handler.login(req, (result) => {
        //console.log(result);

        expect(result.userid.toString()).to.equal(userid.toString());

        return;
      })
      .catch((Error) => {
        console.log(Error);
        throw Error;
        expect(1).to.equals(2);
      });
    });
  });
});
