'use strict';

describe('REST API', () => {

  const config = require('../configuration'),
    jwt = require('../controllers/jwt'),
    db = require('../database/helper');
  let server;
  require('chai').should();
  require('chai').use(require('chai-datetime'));
  let jwtHeader, userid;

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
          payload: minimalData
        };
        return server.inject(options);
      }).then(() => {
        let options = {
          method: 'POST',
          url: '/login',
          headers: {
            'Content-Type': 'application/json'
          },
          payload: {email: minimalData.email, password: minimalData.password}
        };
        return server.inject(options);
      }).then((response) => {
        jwtHeader = response.headers['----jwt----'];
        let payload = JSON.parse(response.payload);
        userid = payload.userid;
      });
    });

  });

  const minimalData = {
    username: 'jdoe',
    email: 'jdoe@test.test',
    password: '12345678',
    language: 'en_EN',
  };

  let options = {
    method: 'DELETE',
    url: '/user/',
    headers: {
      'Content-Type': 'application/json',
      '----jwt----': ''
    },
  };

  let options2 = {
    method: 'GET',
    url: '/user/',
    headers: {
      'Content-Type': 'application/json',
    },
  };

  context('when trying to delete a users data', () => {

    it('it should reply 403 for a not existing user', () => { //QUESTION Or better Not Found?
      let opt = JSON.parse(JSON.stringify(options));
      opt.url += 11;
      opt.headers['----jwt----'] = jwtHeader;
      return server.inject(opt).then((response) => {
        response.should.be.an('object').and.contain.keys('statusCode', 'payload');
        response.statusCode.should.equal(403);
        response.payload.should.be.a('string');
        let payload = JSON.parse(response.payload);
        payload.should.contain.keys('statusCode', 'error', 'message');
        payload.error.should.equal('Forbidden');
      });
    });

    it('it should reply 401 in case the JWT is missing', () => {
      let opt = JSON.parse(JSON.stringify(options));
      opt.url += userid;
      return server.inject(opt).then((response) => {
        response.should.be.an('object').and.contain.keys('statusCode', 'payload');
        response.statusCode.should.equal(401);
        response.payload.should.be.a('string');
        let payload = JSON.parse(response.payload);
        payload.should.contain.keys('statusCode', 'error', 'message');
        payload.error.should.equal('Unauthorized');
      });
    });

    // it('it should reply 400 in case the id parameter is missing', () => {
    //   let opt = JSON.parse(JSON.stringify(options));
    //   opt.url += '';
    //   opt.headers['----jwt----'] = jwtHeader;
    //   return server.inject(opt).then((response) => {
    //     response.should.be.an('object').and.contain.keys('statusCode', 'payload');
    //     response.statusCode.should.equal(400);
    //     response.payload.should.be.a('string');
    //     let payload = JSON.parse(response.payload);
    //     payload.should.contain.keys('statusCode', 'error', 'message');
    //     payload.error.should.equal('Bad Request');
    //   });
    // });
    // Joi validation failed with GET parameters

    it('it should reply 400 in case the id parameter is of wrong type', () => {
      let opt = JSON.parse(JSON.stringify(options));
      opt.url += 'abc';
      opt.headers['----jwt----'] = jwtHeader;
      return server.inject(opt).then((response) => {
        response.should.be.an('object').and.contain.keys('statusCode', 'payload');
        response.statusCode.should.equal(400);
        response.payload.should.be.a('string');
        let payload = JSON.parse(response.payload);
        payload.should.contain.keys('statusCode', 'error', 'message');
        payload.error.should.equal('Bad Request');
      });
    });

    it('it should reply with 200 in case the user is deactivated and after the same call should return 404', () => {
      let opt = JSON.parse(JSON.stringify(options));
      opt.url += userid;
      opt.headers['----jwt----'] = jwtHeader;
      return server.inject(opt).then((response) => {
        response.should.be.an('object').and.contain.keys('statusCode', 'payload');
        response.statusCode.should.equal(200);
        response.payload.should.be.a('string').and.be.empty;
      }).then(() => {
        options2.url += userid;
        console.log(options2);
        return server.inject(options2);
      }).then((response) => {
        response.should.be.an('object').and.contain.keys('statusCode', 'payload');
        response.statusCode.should.equal(423);
        response.payload.should.be.a('string');
        let payload = JSON.parse(response.payload);
        payload.should.be.an('object').and.contain.keys('statusCode', 'error');
        payload.statusCode.should.be.a('number').and.equal(423);
        payload.error.should.be.a('string').and.equal('Locked');
      });
    });

  });
});
