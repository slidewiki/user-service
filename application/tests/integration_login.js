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

  const validLoginData = {
    email: 'jdoe@test.test',
    password: '12345678'
  };

  const invalidLoginData = {
    email: 'jdoe2@test.test',
    password: 'abcdefgh'
  };

  const options = {
    method: 'POST',
    url: '/login',
    headers: {
      'Content-Type': 'application/json'
    },
  };

  context('when trying to log in', () => {
    it('it should reply with at least userid, username and a JWT token for an existing user', () => {
      let opt = JSON.parse(JSON.stringify(options));
      opt.payload = validLoginData;
      return server.inject(opt).then((response) => {
        response.should.be.an('object').and.contain.keys('statusCode', 'payload', 'headers');
        response.statusCode.should.equal(200);
        response.payload.should.be.a('string');
        response.headers.should.be.an('object').and.contain.keys('----jwt----');
        //TODO test jwt validity
        let payload = JSON.parse(response.payload);
        payload.should.be.an('object').and.contain.keys('userid', 'username');
        payload.userid.should.be.a('number').and.equal(1);
        payload.username.should.be.a('string').and.equal(fullData.username);
      });
    });

    it('it should reply with 400 for missing data', () => {
      let opt = JSON.parse(JSON.stringify(options));
      opt.payload = {email: 'jdoe'};
      return server.inject(opt).then((response) => {
        response.should.be.an('object').and.contain.keys('statusCode', 'payload');
        response.statusCode.should.equal(400);
        response.payload.should.be.a('string');
        let payload = JSON.parse(response.payload);
        payload.should.be.an('object').and.contain.keys('statusCode', 'error', 'message', 'validation');
        payload.error.should.be.a('string').and.equal('Bad Request');
      });
    });

    it('it should reply with 404 for non existing users', () => {//TODO using 404?
      let opt = JSON.parse(JSON.stringify(options));
      opt.payload = invalidLoginData;
      return server.inject(opt).then((response) => {
        response.should.be.an('object').and.contain.keys('statusCode', 'payload');
        response.statusCode.should.equal(404);
        response.payload.should.be.a('string');
        let payload = JSON.parse(response.payload);
        payload.should.be.an('object').and.contain.keys('statusCode', 'error', 'message');
        payload.error.should.be.a('string').and.equal('Not Found');
      });
    });

  });
});
