/* eslint dot-notation: 0, "promise/always-catch": 0*/
'use strict';

const config = require('../configuration'),
  jwt = require('../controllers/jwt'),
  db = require('../database/helper');

describe('REST API', () => {

  let server;

  before((done) => {
    //Clean everything up before doing new tests
    Object.keys(require.cache).forEach((key) => delete require.cache[key]);
    require('chai').should();
    let hapi = require('hapi');
    server = new hapi.Server();
    server.connection({
      host: 'localhost',
      port: 3000
    });
    server.register(require('hapi-auth-jwt2'), () => {
      server.auth.strategy('jwt', 'jwt', {
        key: config.JWT.SERIAL,
        validateFunc: jwt.validate,
        verifyOptions: {
          algorithms: [ config.JWT.ALGORITHM ],
          ignoreExpiration: true
        },
        headerKey: config.JWT.HEADER
      });

      server.auth.default('jwt');
      require('../routes.js')(server);
      db.cleanDatabase('slidewiki').then(() => {
        done();
      });
    });

  });

  let minimalData = {
    username: 'jdoe',
    email: 'jdoe@test.test',
    password: '12345678',
    language: 'en_EN',
  };

  let fullData = {
    username: 'jdoe2',
    email: 'jdoe2@test.test',
    password: '12345678',
    language: 'en_EN',
    forename: 'John',
    surname: 'Doe',
    organization: 'Test',
  };

  let options = {
    method: 'POST',
    url: '/register',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  context('when registering a new user', () => {
    it('it should reply a userid for the minimal set of information', (done) => {
      let opt = {};
      Object.assign(opt, options);
      opt.payload = minimalData;
      server.inject(opt, (response) => {
        try{
          response.should.be.an('object').and.contain.keys('statusCode','payload');
          response.statusCode.should.equal(200);
          response.payload.should.be.a('string');
          let payload = JSON.parse(response.payload);
          payload.should.be.an('object').and.contain.keys('userid');
          payload.userid.should.be.a.number;
          done();
        } catch(err){
          done(err);
        }
      });
    });

    it('it should reply a userid for the whole set of information', (done) => {
      let opt = {};
      Object.assign(opt, options);
      opt.payload = fullData;
      server.inject(opt, (response) => {
        try{
          response.should.be.an('object').and.contain.keys('statusCode','payload');
          response.statusCode.should.equal(200);
          response.payload.should.be.a('string');
          let payload = JSON.parse(response.payload);
          payload.should.be.an('object').and.contain.keys('userid');
          payload.userid.should.be.a.number;
          done();
        } catch(err){
          done(err);
        }
      });
    });

    it('it should return 400 about missing parameters for an incomplete set of information', (done) => {
      let opt = {};
      Object.assign(opt, options);
      opt.payload = {username: 'abc'};
      server.inject(opt, (response) => {
        try{
          response.should.be.an('object').and.contain.keys('statusCode','payload');
          response.statusCode.should.equal(400);
          response.payload.should.be.a('string');
          let payload = JSON.parse(response.payload);
          payload.should.be.an('object').and.contain.keys('statusCode', 'error', 'message', 'validation');
          payload.error.should.be.a('string').and.equal('Bad Request');
          done();
        } catch(err){
          done(err);
        }
      });
    });

    it('it should return 422 about an already existing user', (done) => {
      let opt = {};
      Object.assign(opt, options);
      opt.payload = minimalData;
      server.inject(opt, (response) => {
        try{
          response.should.be.an('object').and.contain.keys('statusCode','payload');
          response.statusCode.should.equal(422);
          response.payload.should.be.a('string');
          let payload = JSON.parse(response.payload);
          payload.should.be.an('object').and.contain.keys('statusCode', 'error', 'message');
          payload.error.should.be.a('string').and.equal('Unprocessable Entity');
          done();
        } catch(err){
          done(err);
        }
      });
    });
  });
});
