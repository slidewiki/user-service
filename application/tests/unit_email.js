// example unit tests
'use strict';

//Mocking is missing completely TODO add mocked objects

describe('User service', () => {

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
    config = require('configuration.js');
    done();
  });

  context('Send email with new password', () => {
    it('call it correct', () => {
      let req = {
        params: {
          email: 'me@host.net',
          APIKey: config.SMTP.APIKey
        }
      };
      return handler.resetPassword(req, (result) => {
        console.log(result);

        expect(result.statusCode.toString()).to.equal('200');

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
