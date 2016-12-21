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
      return db.cleanDatabase('slidewiki');
    });

  });

  const minimalData = {
    username: 'jdoe',
    email: 'jdoe@test.test',
    password: '12345678',
    language: 'en_EN',
  };

  const fullData = {
    username: 'jdoe2',
    email: 'jdoe2@test.test',
    password: '12345678',
    language: 'en_EN',
    forename: 'John',
    surname: 'Doe',
    organization: 'Test',
  };

  const options = {
    method: 'POST',
    url: '/register',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  context('when registering a new user', () => {
    it('it should reply a userid for the minimal set of information', () => {
      let opt = JSON.parse(JSON.stringify(options));
      opt.payload = minimalData;
      return server.inject(opt).then((response) => {
        response.should.be.an('object').and.contain.keys('statusCode', 'payload');
        response.statusCode.should.equal(200);
        response.payload.should.be.a('string');
        let payload = JSON.parse(response.payload);
        payload.should.be.an('object').and.contain.keys('userid');
        payload.userid.should.be.a('number');
      });
    });

    it('it should reply a userid for the whole set of information', () => {
      let opt = JSON.parse(JSON.stringify(options));
      opt.payload = fullData;
      return server.inject(opt).then((response) => {
        response.should.be.an('object').and.contain.keys('statusCode','payload');
        response.statusCode.should.equal(200);
        response.payload.should.be.a('string');
        let payload = JSON.parse(response.payload);
        payload.should.be.an('object').and.contain.keys('userid');
        payload.userid.should.be.a('number');
      });
    });

    it('it should return 400 about missing parameters for an incomplete set of information', () => {
      let opt = JSON.parse(JSON.stringify(options));
      opt.payload = {username: 'abc'};
      return server.inject(opt).then((response) => {
        response.should.be.an('object').and.contain.keys('statusCode','payload');
        response.statusCode.should.equal(400);
        response.payload.should.be.a('string');
        let payload = JSON.parse(response.payload);
        payload.should.be.an('object').and.contain.keys('statusCode', 'error', 'message', 'validation');
        payload.error.should.be.a('string').and.equal('Bad Request');
      });
    });

    it('it should return 409 about an already existing user', () => {
      let opt = JSON.parse(JSON.stringify(options));
      opt.payload = minimalData;
      return server.inject(opt).then((response) => {
        response.should.be.an('object').and.contain.keys('statusCode','payload');
        response.statusCode.should.equal(409);
        response.payload.should.be.a('string');
        let payload = JSON.parse(response.payload);
        payload.should.be.an('object').and.contain.keys('statusCode', 'error', 'message');
        payload.error.should.be.a('string').and.equal('Conflict');
      });
    });

  });
});
