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

  let options4 = {
    method: 'GET',
    url: '/user/',
    headers: {
      'Content-Type': 'application/json'
    },
  };

  context('when trying to test the information block', () => {
    it('it should reply that an email is already used in case it is in use', () => {
      let opt = JSON.parse(JSON.stringify(options));
      opt.url += fullData.email;
      return server.inject(opt).then((response) => {
        response.should.be.an('object').and.contain.keys('statusCode', 'payload');
        response.statusCode.should.equal(200);
        response.payload.should.be.a('string');
        let payload = JSON.parse(response.payload);
        payload.should.be.an('object').and.contain.keys('taken');
        payload.taken.should.be.a('boolean').and.equal(true);
      });
    });

    it('it should reply that an email is not used in case it is not in use', () => {
      let opt = JSON.parse(JSON.stringify(options));
      opt.url += 'heros@slidewiki.org';
      return server.inject(opt).then((response) => {
        response.should.be.an('object').and.contain.keys('statusCode', 'payload');
        response.statusCode.should.equal(200);
        response.payload.should.be.a('string');
        let payload = JSON.parse(response.payload);
        payload.should.be.an('object').and.contain.keys('taken');
        payload.taken.should.be.a('boolean').and.equal(false);
      });
    });

    // it('it should return 400 in case the email parameter is missing', () => {
    //   let opt = JSON.parse(JSON.stringify(options));
    //   return server.inject(opt).then((response) => {
    //     response.should.be.an('object').and.contain.keys('statusCode', 'payload');
    //     response.statusCode.should.equal(400);
    //     response.payload.should.be.a('string');
    //     let payload = JSON.parse(response.payload);
    //     payload.should.be.an('object').and.contain.keys('statusCode', 'error', 'message', 'validation');
    //     payload.error.should.be.a('string').and.equal('Bad Request');
    //   });
    // });
    // Joi validation failed with GET parameters

    it('it should reply that a username is already used in case it is in use and tell similar used usernames', () => {
      let opt = JSON.parse(JSON.stringify(options2));
      opt.url += fullData.username;
      return server.inject(opt).then((response) => {
        response.should.be.an('object').and.contain.keys('statusCode', 'payload');
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
      let opt = JSON.parse(JSON.stringify(options2));
      opt.url += 'hero';
      return server.inject(opt).then((response) => {
        response.should.be.an('object').and.contain.keys('statusCode', 'payload');
        response.statusCode.should.equal(200);
        response.payload.should.be.a('string');
        let payload = JSON.parse(response.payload);
        payload.should.be.an('object').and.contain.keys('taken', 'alsoTaken');
        payload.taken.should.be.a('boolean').and.equal(false);
        payload.alsoTaken.should.be.an('array').and.be.empty;
      });
    });

    // it('it should return 400 in case the username parameter is missing', () => {
    //   let opt = JSON.parse(JSON.stringify(options2));
    //   return server.inject(opt).then((response) => {
    //     response.should.be.an('object').and.contain.keys('statusCode', 'payload');
    //     response.statusCode.should.equal(400);
    //     response.payload.should.be.a('string');
    //     let payload = JSON.parse(response.payload);
    //     payload.should.be.an('object').and.contain.keys('statusCode', 'error', 'message', 'validation');
    //     payload.error.should.be.a('string').and.equal('Bad Request');
    //   });
    // });
    // Joi validation failed with GET parameters

    it('it should reply that a username is already used in case it is in use and tell similar used usernames', () => {
      let opt = JSON.parse(JSON.stringify(options3));
      opt.url += fullData.username;
      return server.inject(opt).then((response) => {
        response.should.be.an('object').and.contain.keys('statusCode', 'payload');
        response.statusCode.should.equal(200);
        response.payload.should.be.a('string');
        let payload = JSON.parse(response.payload);
        console.log('payload:', payload);
        payload.should.be.an('object').and.contain.keys('success', 'results');
        payload.success.should.be.a('boolean').and.equal(true);
        payload.results.should.be.an('array').and.be.not.empty;
        payload.results.should.have.lengthOf(1);
        let tmp = payload.results[0];
        tmp.should.be.an('object').and.contain.keys('name', 'value');
        tmp.name.should.equal(fullData.username);
        let value = JSON.parse(decodeURIComponent(tmp.value));
        value.userid.should.equal(1);
      });
    });

    it('it should reply that a username is not used in case it is not in use', () => {
      let opt = JSON.parse(JSON.stringify(options3));
      opt.url += 'hero';
      return server.inject(opt).then((response) => {
        response.should.be.an('object').and.contain.keys('statusCode', 'payload');
        response.statusCode.should.equal(200);
        response.payload.should.be.a('string');
        let payload = JSON.parse(response.payload);
        payload.should.be.an('object').and.contain.keys('success', 'results');
        payload.success.should.be.a('boolean').and.equal(true);
        payload.results.should.be.an('array').and.be.empty;
      });
    });

    // it('it should return 400 in case the username parameter is missing', () => {  //TODO 200 with emtpy array should be returned
    //   let opt = JSON.parse(JSON.stringify(options3));
    //   return server.inject(opt).then((response) => {
    //     response.should.be.an('object').and.contain.keys('statusCode', 'payload');
    //     response.statusCode.should.equal(400);
    //     response.payload.should.be.a('string');
    //     let payload = JSON.parse(response.payload);
    //     payload.should.be.an('object').and.contain.keys('statusCode', 'error', 'message', 'validation');
    //     payload.error.should.be.a('string').and.equal('Bad Request');
    //   });
    // });
    // Joi validation failed with GET parameters

    it('it should reply the public user information for a registered user', () => {
      let opt = JSON.parse(JSON.stringify(options4));
      opt.url += fullData.username;
      return server.inject(opt).then((response) => {
        response.should.be.an('object').and.contain.keys('statusCode', 'payload');
        response.statusCode.should.equal(200);
        response.payload.should.be.a('string');
        let payload = JSON.parse(response.payload);
        payload.should.be.an('object').and.contain.keys('_id', 'username', 'country', 'picture', 'description', 'organization');
        payload._id.should.be.a('number').and.equal(1);
        payload.username.should.be.an('string').and.equal(fullData.username);
        payload.organization.should.be.an('string').and.equal(fullData.organization);
      });
    });

    it('it should reply 404 for a not existing user', () => {
      let opt = JSON.parse(JSON.stringify(options4));
      opt.url += 'hero';
      return server.inject(opt).then((response) => {
        response.should.be.an('object').and.contain.keys('statusCode', 'payload');
        response.statusCode.should.equal(404);
        response.payload.should.be.a('string');
        let payload = JSON.parse(response.payload);
        payload.should.be.an('object').and.contain.keys('statusCode', 'error');
        payload.statusCode.should.be.a('number').and.equal(404);
        payload.error.should.be.a('string').and.equal('Not Found');
      });
    });

    // it('it should return 400 in case the username parameter is missing', () => {
    //   let opt = JSON.parse(JSON.stringify(options4));
    //   return server.inject(opt).then((response) => {
    //     response.should.be.an('object').and.contain.keys('statusCode', 'payload');
    //     response.statusCode.should.equal(400);
    //     response.payload.should.be.a('string');
    //     let payload = JSON.parse(response.payload);
    //     payload.should.be.an('object').and.contain.keys('statusCode', 'error', 'message', 'validation');
    //     payload.error.should.be.a('string').and.equal('Bad Request');
    //   });
    // });
    // Joi validation failed with GET parameters

  });
});
