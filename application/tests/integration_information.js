'use strict';

describe('REST API', () => {

  const config = require('../configuration'),
    jwt = require('../controllers/jwt'),
    db = require('../database/helper');
  let server;
  require('chai').should();

  before(() => {
    //Clean everything up before doing new tests
    Object.keys(require.cache).forEach((key) => delete require.cache[key]);
    let hapi = require('hapi');
    server = new hapi.Server();
    server.connection({
      host: 'localhost',
      port: 3000
    });
    return server.register(require('hapi-auth-jwt2')).then(() => {
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
      return db.cleanDatabase('slidewiki').then(() => {
        let options = {
          method: 'POST',
          url: '/register',
          headers: {
            'Content-Type': 'application/json'
          },
          payload: fullData
        };
        return server.inject(options);
      });
    });

  });

  const fullData = {
    username: 'jdoe',
    email: 'jdoe@test.test',
    password: '12345678',
    language: 'en_EN',
    forename: 'John',
    surname: 'Doe',
    organization: 'Test',
  };

  let options = {
    method: 'GET',
    url: '/information/email/',
    headers: {
      'Content-Type': 'application/json'
    },
  };

  let options2 = {
    method: 'GET',
    url: '/information/username/',
    headers: {
      'Content-Type': 'application/json'
    },
  };

  let options3 = {
    method: 'GET',
    url: '/information/username/search/',
    headers: {
      'Content-Type': 'application/json'
    },
  };

  context('when trying to test the information block', () => {
    it('it should reply that an email is already used in case it is in use', () => {
      let opt = {};
      Object.assign(opt, options);
      opt.url += fullData.email;
      return server.inject(opt).then((response) => {
        response.should.be.an('object').and.contain.keys('statusCode', 'payload', 'headers');
        response.statusCode.should.equal(200);
        response.payload.should.be.a('string');
        let payload = JSON.parse(response.payload);
        payload.should.be.an('object').and.contain.keys('taken');
        payload.taken.should.be.a('boolean').and.equal(true);
      });
    });

    it('it should reply that an email is not used in case it is not in use', () => {
      let opt = {};
      Object.assign(opt, options);
      opt.url += 'heros@slidewiki.org';
      return server.inject(opt).then((response) => {
        response.should.be.an('object').and.contain.keys('statusCode', 'payload', 'headers');
        response.statusCode.should.equal(200);
        response.payload.should.be.a('string');
        let payload = JSON.parse(response.payload);
        payload.should.be.an('object').and.contain.keys('taken');
        payload.taken.should.be.a('boolean').and.equal(false);
      });
    });

    it('it should return 400 in case the email parameter is missing', () => {
      let opt = {};
      Object.assign(opt, options);
      return server.inject(opt).then((response) => {
        response.should.be.an('object').and.contain.keys('statusCode', 'payload', 'headers');
        response.statusCode.should.equal(400);
        response.payload.should.be.a('string');
        let payload = JSON.parse(response.payload);
        payload.should.be.an('object').and.contain.keys('statusCode', 'error', 'message', 'validation');
        payload.error.should.be.a('string').and.equal('Bad Request');
      });
    });

    it('it should reply that a username is already used in case it is in use and tell similar used usernames', () => {
      let opt = {};
      Object.assign(opt, options2);
      opt.url += fullData.username;
      return server.inject(opt).then((response) => {
        response.should.be.an('object').and.contain.keys('statusCode', 'payload', 'headers');
        response.statusCode.should.equal(200);
        response.payload.should.be.a('string');
        let payload = JSON.parse(response.payload);
        payload.should.be.an('object').and.contain.keys('taken', 'alsoTaken');
        payload.taken.should.be.a('boolean').and.equal(true);
        payload.alsoTaken.should.be.an('array').and.be.not.empty;
        payload.alsoTaken.should.contain('jdoe');
      });
    });

    it('it should reply that a username is not used in case it is not in use', () => {
      let opt = {};
      Object.assign(opt, options2);
      opt.url += 'hero';
      return server.inject(opt).then((response) => {
        response.should.be.an('object').and.contain.keys('statusCode', 'payload', 'headers');
        response.statusCode.should.equal(200);
        response.payload.should.be.a('string');
        let payload = JSON.parse(response.payload);
        payload.should.be.an('object').and.contain.keys('taken', 'alsoTaken');
        payload.taken.should.be.a('boolean').and.equal(false);
        payload.alsoTaken.should.be.an('array').and.be.empty;
      });
    });

    it('it should return 400 in case the username parameter is missing', () => {
      let opt = {};
      Object.assign(opt, options2);
      return server.inject(opt).then((response) => {
        response.should.be.an('object').and.contain.keys('statusCode', 'payload', 'headers');
        response.statusCode.should.equal(400);
        response.payload.should.be.a('string');
        let payload = JSON.parse(response.payload);
        payload.should.be.an('object').and.contain.keys('statusCode', 'error', 'message', 'validation');
        payload.error.should.be.a('string').and.equal('Bad Request');
      });
    });

    it('it should reply that a username is already used in case it is in use and tell similar used usernames', () => {
      let opt = {};
      Object.assign(opt, options3);
      opt.url += fullData.username;
      return server.inject(opt).then((response) => {
        response.should.be.an('object').and.contain.keys('statusCode', 'payload', 'headers');
        response.statusCode.should.equal(200);
        response.payload.should.be.a('string');
        let payload = JSON.parse(response.payload);
        console.log(payload);
        payload.should.be.an('object').and.contain.keys('success', 'results');
        payload.success.should.be.a('boolean').and.equal(true);
        payload.results.should.be.an('array').and.be.not.empty;
        payload.results.should.have.lengthOf(1);
        let tmp = payload.results[0];
        tmp.should.be.an('object').and.contain.keys('name', 'value');
        tmp.name.should.equal(fullData.username);
        tmp.value.should.equal(1);
      });
    });

    it('it should reply that a username is not used in case it is not in use', () => {
      let opt = {};
      Object.assign(opt, options3);
      opt.url += 'hero';
      return server.inject(opt).then((response) => {
        response.should.be.an('object').and.contain.keys('statusCode', 'payload', 'headers');
        response.statusCode.should.equal(200);
        response.payload.should.be.a('string');
        let payload = JSON.parse(response.payload);
        console.log(payload);
        payload.should.be.an('object').and.contain.keys('success', 'results');
        payload.success.should.be.a('boolean').and.equal(true);
        payload.results.should.be.an('array').and.be.empty;
      });
    });

    it('it should return 400 in case the username parameter is missing', () => {
      let opt = {};
      Object.assign(opt, options3);
      return server.inject(opt).then((response) => {
        response.should.be.an('object').and.contain.keys('statusCode', 'payload', 'headers');
        response.statusCode.should.equal(400);
        response.payload.should.be.a('string');
        let payload = JSON.parse(response.payload);
        payload.should.be.an('object').and.contain.keys('statusCode', 'error', 'message', 'validation');
        payload.error.should.be.a('string').and.equal('Bad Request');
      });
    });

  });
});
