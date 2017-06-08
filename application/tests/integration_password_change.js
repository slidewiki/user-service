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
      return db.cleanDatabase(config.MongoDB.SLIDEWIKIDATABASE).then(() => {
        let options = {
          method: 'POST',
          url: '/register',
          headers: {
            'Content-Type': 'application/json'
          },
          payload: fullData
        };
        return server.inject(options);
      }).then(() => {
        let options = {
          method: 'POST',
          url: '/login',
          headers: {
            'Content-Type': 'application/json'
          },
          payload: {email: fullData.email, password: fullData.password}
        };
        return server.inject(options);
      }).then((response) => {
        jwtHeader = response.headers['----jwt----'];
        let payload = JSON.parse(response.payload);
        userid = payload.userid;
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

  let options2 = {
    method: 'PUT',
    url: '/user/', //+passwd at the end
    headers: {
      'Content-Type': 'application/json',
      '----jwt----': ''
    },
  };

  context('when trying to change the password of a user', () => {

    it('it should reply with 200 if the password has been changed', () => {
      let opt = JSON.parse(JSON.stringify(options2));
      opt.url += userid + '/passwd';
      opt.headers['----jwt----'] = jwtHeader;
      opt.payload = {};
      opt.payload.oldPassword = fullData.password;
      opt.payload.newPassword = 'abcdefgh';
      return server.inject(opt).then((response) => {
        response.should.be.an('object').and.contain.keys('statusCode', 'payload');
        response.statusCode.should.equal(200);
        response.payload.should.be.a('string').and.be.empty;
      });
    });

    it('it should reply 403 for a not existing user', () => { //QUESTION Or better Not Found?
      let opt = JSON.parse(JSON.stringify(options2));
      opt.url += 11 + '/passwd';
      opt.headers['----jwt----'] = jwtHeader;
      opt.payload = {};
      opt.payload.oldPassword = fullData.password;
      opt.payload.newPassword = 'abcdefgh';
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
      let opt = JSON.parse(JSON.stringify(options2));
      opt.url += 11 + '/passwd';
      opt.payload = {};
      opt.payload.oldPassword = fullData.password;
      opt.payload.newPassword = 'abcdefgh';
      return server.inject(opt).then((response) => {
        response.should.be.an('object').and.contain.keys('statusCode', 'payload');
        response.statusCode.should.equal(401);
        response.payload.should.be.a('string');
        let payload = JSON.parse(response.payload);
        payload.should.contain.keys('statusCode', 'error', 'message');
        payload.error.should.equal('Unauthorized');
      });
    });

    it('it should reply 400 in case one parameter is missing', () => {
      let opt = JSON.parse(JSON.stringify(options2));
      opt.url += userid + '/passwd';
      opt.headers['----jwt----'] = jwtHeader;
      opt.payload = {};
      opt.payload.oldPassword = fullData.password;
      return server.inject(opt).then((response) => {
        response.should.be.an('object').and.contain.keys('statusCode', 'payload');
        response.statusCode.should.equal(400);
        response.payload.should.be.a('string');
        let payload = JSON.parse(response.payload);
        payload.should.contain.keys('statusCode', 'error', 'message');
        payload.error.should.equal('Bad Request');
      });
    });

    it('it should reply 400 in case one parameter is missing', () => {
      let opt = JSON.parse(JSON.stringify(options2));
      opt.url += userid + '/passwd';
      opt.headers['----jwt----'] = jwtHeader;
      opt.payload = {};
      opt.payload.newPassword = 'abcdefgh';
      return server.inject(opt).then((response) => {
        response.should.be.an('object').and.contain.keys('statusCode', 'payload');
        response.statusCode.should.equal(400);
        response.payload.should.be.a('string');
        let payload = JSON.parse(response.payload);
        payload.should.contain.keys('statusCode', 'error', 'message');
        payload.error.should.equal('Bad Request');
      });
    });

    it('it should reply 400 in case all parameters are missing', () => {
      let opt = JSON.parse(JSON.stringify(options2));
      opt.url += userid + '/passwd';
      opt.headers['----jwt----'] = jwtHeader;
      opt.payload = {};
      return server.inject(opt).then((response) => {
        response.should.be.an('object').and.contain.keys('statusCode', 'payload');
        response.statusCode.should.equal(400);
        response.payload.should.be.a('string');
        let payload = JSON.parse(response.payload);
        payload.should.contain.keys('statusCode', 'error', 'message');
        payload.error.should.equal('Bad Request');
      });
    });

    it('it should reply 404 in case the old password is wrong', () => {
      let opt = JSON.parse(JSON.stringify(options2));
      opt.url += userid + '/passwd';
      opt.headers['----jwt----'] = jwtHeader;
      opt.payload = {};
      opt.payload.oldPassword = fullData.password;
      opt.payload.newPassword = 'abcdefgh';
      return server.inject(opt).then((response) => {
        response.should.be.an('object').and.contain.keys('statusCode', 'payload');
        response.statusCode.should.equal(404);
        response.payload.should.be.a('string');
        let payload = JSON.parse(response.payload);
        payload.should.contain.keys('statusCode', 'error', 'message');
        payload.error.should.equal('Not Found');
      });
    });

    // it('it should reply 409 in case the passwords are the same', () => {
    //   let opt = JSON.parse(JSON.stringify(options2));
    //   opt.url += userid + '/passwd';
    //   opt.headers['----jwt----'] = jwtHeader;
    //   opt.payload = {};
    //   opt.payload.oldPassword = 'abcdefgh';
    //   opt.payload.newPassword = 'abcdefgh';
    //   return server.inject(opt).then((response) => {
    //     response.should.be.an('object').and.contain.keys('statusCode', 'payload');
    //     response.statusCode.should.equal(409);
    //     response.payload.should.be.a('string');
    //     let payload = JSON.parse(response.payload);
    //     payload.should.contain.keys('statusCode', 'error', 'message');
    //     payload.error.should.equal('Conflict');
    //   });
    // });

  });
});
