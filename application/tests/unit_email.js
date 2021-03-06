// example unit tests
'use strict';

//Mocking is missing completely TODO add mocked objects

describe('User service Unit tests', () => {

  let handler, expect, config;

  beforeEach((done) => {
    //Clean everything up before doing new tests
    Object.keys(require.cache).forEach((key) => delete require.cache[key]);
    require('chai').should();
    let chai = require('chai');
    let chaiAsPromised = require('chai-as-promised');
    chai.use(chaiAsPromised);
    expect = require('chai').expect;
    handler = require('../controllers/handler.js');
    config = require('../configuration.js');
    done();
  });

  const correct_user1 = {
    username: 'tboonxemailtest',
    forename: 'Kurt',
    surname: 'Junghanns',
    email: 'tboonxemailtest@gmail.com',
    password: '2347298347823648263284t374t',
    language: 'de',
    defaults: [{
      language: 'de'
    }]
  };
  let userid = 1;

  context('Use sendMail function', () => {
    it('wrong type of reason id', () => {
      let req = {
        payload: {
          reason: true
        }
      };
      return handler.sendEmail(req, (result) => {
        expect(result.output.statusCode.toString()).to.equal('404');

        return;
      });
    });
    it('wrong reason id', () => {
      let req = {
        payload: {
          reason: 0
        }
      };
      return handler.sendEmail(req, (result) => {
        expect(result.output.statusCode.toString()).to.equal('404');

        return;
      });
    });
    it('correct reason id but wrong data', () => {
      let req = {
        payload: {
          reason: 1,
          data: {
            dummy: 12,
            deckname: false
          }
        }
      };
      return handler.sendEmail(req, (result) => {
        expect(result.output.statusCode.toString()).to.equal('400');

        return;
      });
    });
    it('correct reason id but wrong data #2', () => {
      let req = {
        payload: {
          reason: 2,
          data: {
            fileName: 1,
            deck: 1
          }
        }
      };
      return handler.sendEmail(req, (result) => {
        expect(result.output.statusCode.toString()).to.equal('400');

        return;
      });
    });
    it('correct reason id but wrong data #3', () => {
      let req = {
        payload: {
          reason: 1,
          data: {
            deckname: 'test',
            deckid: 1
          }
        },
        params: {
          id: 3287462384
        }
      };
      return handler.sendEmail(req, (result) => {
        expect(result.output.statusCode.toString()).to.equal('404');

        return;
      });
    });

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
    it('correct reason id 1', () => {
      let req = {
        payload: {
          reason: 1,
          data: {
            deckname: 'test',
            deckid: 1
          }
        },
        params: {
          id: userid
        },
        auth: {
          credentials: {
            username: 'Kurt'
          }
        }
      };
      return handler.sendEmail(req, (result) => {
        console.log(result);

        expect(result).to.equal(undefined);

        return;
      });
    });
    it('correct reason id 2', () => {
      let req = {
        payload: {
          reason: 2,
          data: {
            fileName: 'test',
            deck: 1,
            creationDate: (new Date()).toISOString(),
            revision: 1
          }
        },
        params: {
          id: userid
        },
        auth: {
          credentials: {
            username: 'Kurt'
          }
        }
      };
      return handler.sendEmail(req, (result) => {
        console.log(result);

        expect(result).to.equal(undefined);

        return;
      });
    });

  });
});
