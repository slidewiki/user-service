/*
This service manages user accounts. Used for credential login and user information management.
 */

'use strict';

//This is our webserver framework (instead of express)
const hapi = require('hapi'),
  co = require('./common'),
  config = require('./configuration'),
  jwt = require('./controllers/jwt'),
  yar = require('yar'),
  Grant = require('grant-hapi');

//Initiate the webserver with standard or given port
const server = new hapi.Server({ connections: {routes: {validate: { options: {convert : false}}}}});

let port = (!co.isEmpty(process.env.APPLICATION_PORT)) ? process.env.APPLICATION_PORT : 3000;
server.connection({
  port: port
});
let host = (!co.isEmpty(process.env.VIRTUAL_HOST)) ? process.env.VIRTUAL_HOST : server.info.host;

//Export the webserver to be able to use server.log()
module.exports = server;

//Plugin for sweet server console output
let plugins = [
  require('inert'),
  require('vision'), {
    register: require('good'),
    options: {
      ops: {
        interval: 1000
      },
      reporters: {
        console: [{
          module: 'good-squeeze',
          name: 'Squeeze',
          args: [{
            log: '*',
            response: '*',
            request: '*'
          }]
        }, {
          module: 'good-console'
        }, 'stdout']
      }
    }
  }, { //Plugin for swagger API documentation
    register: require('hapi-swagger'),
    options: {
      host: host,
      info: {
        title: 'User API',
        description: 'Whole API description of th user-service with live testing feature! Powered by node, hapi, joi, hapi-swaggered, hapi-swaggered-ui and swagger-ui',
        version: '1.x'
      }
    }
  },
  require('hapi-auth-jwt2'),
  {
    register: yar,  //For cookie handling - most OAuth2 providers doing a handshake with a unified cookie value to verify the requests
    options: {
      cookieOptions: {
        password: '12345678901113151234567890111315',
        isSecure: false
      }
    }
  },
  // mount grant
  {
    register: new Grant(),
    options: require('./config.json')
  }
];

const createIndexes = require('./database/createIndexes');

//Register plugins and start webserver
server.register(plugins, (err) => {
  if (err) {
    console.error(err);
    global.process.exit();
  } else {
    server.auth.strategy('jwt', 'jwt', {
      key: config.JWT.SERIAL,
      validateFunc: jwt.validate,
      verifyOptions: {
        algorithms: [ config.JWT.ALGORITHM ],
        ignoreExpiration: true
      },
      headerKey: config.JWT.HEADER
    });

    // create any indexes before starting the server
    createIndexes().catch((err) => {
      console.warn('error creating the indexes on the database collection:');
      console.warn(err.message);
    }).then(() => {
      server.start(() => {
        server.log('info', 'Server started at ' + server.info.uri);
        //Register routes
        require('./routes.js')(server);
      });
    });
  }
});
