/*

Each route implementes a basic parameter/payload validation and a swagger API documentation description
*/
'use strict';

const Joi = require('joi'),
  handlers = require('./controllers/handler');

module.exports = function (server) {
  //Register new user with credentials
  server.route({
    method: 'POST',
    path: '/register',
    handler: handlers.register,
    config: {
      validate: {
        payload: Joi.object().keys({
          surname: Joi.string(),
          name: Joi.string(),
          username: Joi.string().alphanum(),
          email: Joi.string().email(),
          password: Joi.string(),
          language: Joi.string()
        }).requiredKeys('name', 'username', 'email', 'password'),
      },
      tags: ['api'],
      description: 'Register a new user',
      response: {
        schema: Joi.object().keys({
          success: Joi.boolean()
        })
      }
    }
  });

  //Login with credentials
  server.route({
    method: 'POST',
    path: '/login',
    handler: handlers.login,
    config: {
      validate: {
        payload: Joi.object().keys({
          username: Joi.string().alphanum(),
          password: Joi.string()
        })
      },
      tags: ['api'],
      description: 'Login',
      response: {
        schema: Joi.object().keys({
          access_token: Joi.string(),
          expires_in: Joi.number(),
          user_id: Joi.string()
        })
      }
    }
  });

  //Get a user
  server.route({
    method: 'GET',
    path: '/user/{id}',
    handler: handlers.getUser,
    config: {
      validate: {
        params: {
          id: Joi.string().alphanum()
        }
      },
      tags: ['api'],
      description: 'Get user by id'
    }
  });

  //Delete user
  server.route({
    method: 'DELETE',
    path: '/user/{id}',
    handler: handlers.deleteUser,
    config: {
      validate: {
        params: {
          id: Joi.string().alphanum()
        }
      },
      tags: ['api'],
      description: 'Delete a user',
      response: {
        schema: Joi.object().keys({
          success: Joi.boolean()
        })
      }
    }
  });

  //Update a user with a new JSON representation
  server.route({
    method: 'PUT',
    path: '/user/{id}',
    handler: handlers.updateUser,
    config: {
      validate: {
        params: {
          id: Joi.string().alphanum()
        }
      },
      tags: ['api'],
      description: 'Update a user',
      response: {
        schema: Joi.object().keys({
          user_id: Joi.string()
        })
      }
    }
  });
};
