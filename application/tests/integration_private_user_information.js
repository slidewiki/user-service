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

  let options = {
    method: 'GET',
    url: '/user/', //+profile at the end
    headers: {
      'Content-Type': 'application/json',
      '----jwt----': ''
    },
  };

  context('when trying to get private user information', () => {
    it('it should reply all user information for a registered user', () => {
      let opt = JSON.parse(JSON.stringify(options));
      opt.url += userid + '/profile';
      opt.headers['----jwt----'] = jwtHeader;
      return server.inject(opt).then((response) => {
        response.should.be.an('object').and.contain.keys('statusCode', 'payload');
        response.statusCode.should.equal(200);
        response.payload.should.be.a('string');
        let payload = JSON.parse(response.payload);
        payload.should.be.an('object').and.contain.keys('_id', 'username', 'country', 'picture', 'description', 'organization', 'surname', 'forename', 'email', 'registered', 'groups', 'language');
        payload._id.should.be.a('number').and.equal(1);
        let comp = Object.assign({},fullData);
        delete comp.password;
        payload.should.include(comp);
        payload.groups.should.be.an('array').and.be.empty;
        let tmp = new Date(payload.registered);
        let current = new Date();
        tmp.should.beforeTime(current);
      });
    });

    it('it should reply 403 for a not existing user', () => { //TODO Correct test - also ad not found if jwt was ok and user not in database
      let opt = JSON.parse(JSON.stringify(options));
      opt.url += '10' + '/profile';
      opt.headers['----jwt----'] = jwtHeader;
      return server.inject(opt).then((response) => {
        // console.log('testresult:', response.statusCode, response.payload);
        response.should.be.an('object').and.contain.keys('statusCode', 'payload');
        response.statusCode.should.equal(401);
        response.payload.should.be.a('string');
        let payload = JSON.parse(response.payload);
        payload.should.contain.keys('statusCode', 'error', 'message');
        payload.error.should.equal('Unauthorized');
      });
    });

    it('it should reply 401 in case the JWT is missing', () => {
      let opt = JSON.parse(JSON.stringify(options));
      opt.url += userid + '/profile';
      return server.inject(opt).then((response) => {
        response.should.be.an('object').and.contain.keys('statusCode', 'payload');
        response.statusCode.should.equal(401);
        response.payload.should.be.a('string');
        let payload = JSON.parse(response.payload);
        payload.should.contain.keys('statusCode', 'error', 'message');
        payload.error.should.equal('Unauthorized');
      });
    });

  });
});
