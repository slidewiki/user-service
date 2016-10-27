/*
Each route implementes a basic parameter/payload validation and a swagger API documentation description
*/
'use strict';

const Joi = require('joi'),
  handlers = require('./controllers/handler'),
  handlers_social = require('./controllers/handler_social');

module.exports = function (server) {
  //Register new user with credentials
  server.route({
    method: 'POST',
    path: '/register',
    handler: handlers.register,
    config: {
      validate: {
        payload: Joi.object().keys({
          forename: Joi.string().allow('').optional(),
          surname: Joi.string().allow('').optional(),
          username: Joi.string().alphanum(),
          email: Joi.string().email(),
          password: Joi.string().min(8),
          language: Joi.string().length(5),
          organization: Joi.string()
        }).requiredKeys('username', 'email', 'password', 'language'),
      },
      tags: ['api'],
      description: 'Register a new user with unique username and email',
      response: {
        schema: Joi.object().keys({
          userid: Joi.number().integer()
        })
      },
      auth: false,
      plugins: {
        'hapi-swagger': {
          responses: {
            ' 200 ': {
              'description': 'Successful',
              'headers': {
                '----jwt----': {
                  'description': 'Contains the JWT'
                }
              }
            },
            ' 422 ': {
              'description': 'Wrong user data - see error message',
              schema: Joi.object().keys({
                statusCode: Joi.number().integer(),
                error: Joi.string(),
                message: Joi.string()
              }).required()
            }
          },
          payloadType: 'form'
        },
        yar: {
          skip: true
        }
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
          email: Joi.string().email(),
          password: Joi.string()
        })
      },
      tags: ['api'],
      description: 'Login',
      auth: false,
      plugins: {
        'hapi-swagger': {
          responses: {
            ' 200 ': {
              'description': 'Successful',
              'headers': {
                '----jwt----': {
                  'description': 'Contains the JWT'
                }
              },
              schema: Joi.object().keys({
                access_token: Joi.string(),
                expires_in: Joi.number(),
                userid: Joi.number().integer(),
                username: Joi.string()
              }).required()
            },
            ' 401 ': {
              'description': 'The credentials are wrong',
              'headers': {
                'WWW-Authenticate': {
                  'description': '{"email":"", "password": ""}'
                }
              }
            }
          },
          payloadType: 'form'
        },
        yar: {
          skip: true
        }
      }
    }
  });

  //Get a user
  server.route({
    method: 'GET',
    path: '/user/{id}/profile',
    handler: handlers.getUser,
    config: {
      validate: {
        params: {
          id: Joi.number().integer().options({convert: true})
        },
        headers: Joi.object({
          '----jwt----': Joi.string().required().description('JWT header provided by /login')
        }).unknown()
      },
      tags: ['api'],
      description: 'Get detailed information about a user by id - JWT needed',
      auth: 'jwt',
      plugins: {
        'hapi-swagger': {
          responses: {
            ' 200 ': {
              'description': 'Successful',
            },
            ' 401 ': {
              'description': 'Not authorized to access another users profile',
              'headers': {
                'WWW-Authenticate': {
                  'description': 'Use your JWT token and the right userid.'
                }
              }
            },
            ' 404 ': {
              'description': 'User not found. Check the id.'
            }
          },
          payloadType: 'form'
        },
        yar: {
          skip: true
        }
      }
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
          id: Joi.number().integer().options({convert: true})
        },
        headers: Joi.object({
          '----jwt----': Joi.string().required().description('JWT header provided by /login')
        }).unknown()
      },
      tags: ['api'],
      description: 'Delete a user - JWT needed',
      auth: 'jwt',
      plugins: {
        'hapi-swagger': {
          responses: {
            ' 200 ': {
              'description': 'Successful',
            },
            ' 401 ': {
              'description': 'Not authorized to delete another user.',
              'headers': {
                'WWW-Authenticate': {
                  'description': 'Use your JWT token and the right userid.'
                }
              }
            },
            ' 404 ': {
              'description': 'User not found. Check the id.'
            }
          },
          payloadType: 'form'
        },
        yar: {
          skip: true
        }
      }
    }
  });

  //User Profile

  //Update a users password
  server.route({
    method: 'PUT',
    path: '/user/{id}/passwd',
    handler: handlers.updateUserPasswd,
    config: {
      validate: {
        params: {
          id: Joi.number().integer().options({convert: true})
        },
        payload: Joi.object().keys({
          oldPassword: Joi.string().min(8),
          newPassword: Joi.string().min(8)
        }),
        headers: Joi.object({
          '----jwt----': Joi.string().required().description('JWT header provided by /login')
        }).unknown()
      },
      tags: ['api'],
      description: 'Update a users password - JWT needed',
      auth: 'jwt',
      plugins: {
        'hapi-swagger': {
          responses: {
            ' 200 ': {
              'description': 'Successful',
            },
            ' 401 ': {
              'description': 'Not authorized to change the password of another user.',
              'headers': {
                'WWW-Authenticate': {
                  'description': 'Use your JWT token and the right userid.'
                }
              }
            },
            ' 404 ': {
              'description': 'User not found. Check the id.'
            }
          },
          payloadType: 'form'
        },
        yar: {
          skip: true
        }
      }
    }
  });

  //Update a users profile with the given JSON representation
  server.route({
    method: 'PUT',
    path: '/user/{id}/profile',
    handler: handlers.updateUserProfile,
    config: {
      validate: {
        params: {
          id: Joi.number().integer().options({convert: true})
        },
        payload: Joi.object().keys({
          email: Joi.string().email(),
          username: Joi.string().alphanum(),
          surname: Joi.string().allow('').optional(),
          forename: Joi.string().allow('').optional(),
          //sex: Joi.string(),  //not used right now
          language: Joi.string().length(5),
          country: Joi.string().allow('').optional(),
          picture: Joi.string().uri().allow('').optional(),
          description: Joi.string().allow('').optional(),
          organization: Joi.string().allow('').optional()
        }).requiredKeys('email', 'username', 'language'),
        headers: Joi.object({
          '----jwt----': Joi.string().required().description('JWT header provided by /login')
        }).unknown()
      },
      tags: ['api'],
      description: 'Update a user - JWT needed',
      auth: 'jwt',
      plugins: {
        'hapi-swagger': {
          responses: {
            ' 200 ': {
              'description': 'Successful',
            },
            ' 401 ': {
              'description': 'Not authorized to update another users profile.',
              'headers': {
                'WWW-Authenticate': {
                  'description': 'Use your JWT token and the right userid.'
                }
              }
            },
            ' 404 ': {
              'description': 'User not found. Check the id.'
            },
            ' 406 ': {
              'description': 'Username could not be changed with the API.'
            },
            ' 409 ': {
              'description': 'The new email adress is already taken by another user.'
            }
          },
          payloadType: 'form'
        },
        yar: {
          skip: true
        }
      }
    }
  });

  //Get a user
  server.route({
    method: 'GET',
    path: '/user/{identifier}',
    handler: handlers.getPublicUser,
    config: {
      validate: {
        params: {
          identifier: Joi.string().description('Could be the id as integer or the username as string')
        }
      },
      tags: ['api'],
      description: 'Get public information about a user by id',
      auth: false,
      plugins: {
        'hapi-swagger': {
          responses: {
            ' 200 ': {
              'description': 'Successful',
            },
            ' 404 ': {
              'description': 'User not found. Check the id.'
            }
          },
          payloadType: 'form'
        },
        yar: {
          skip: true
        }
      }
    }
  });

  //Check if username is already taken
  server.route({
    method: 'GET',
    path: '/information/username/{username}',
    handler: handlers.checkUsername,
    config: {
      validate: {
        params: {
          username: Joi.string()
        }
      },
      tags: ['api'],
      description: 'Checks if username exists already',
      response: {
        schema: Joi.object().keys({
          taken: Joi.boolean().required(),
          alsoTaken: Joi.array().items(Joi.string()).required()
        }).required()
      },
      auth: false,
      plugins: {
        'hapi-swagger': {
          responses: {
            ' 200 ': {
              'description': 'Successful',
            }
          },
          payloadType: 'form'
        },
        yar: {
          skip: true
        }
      }
    }
  });

  //Check if email is already in use
  server.route({
    method: 'GET',
    path: '/information/email/{email}',
    handler: handlers.checkEmail,
    config: {
      validate: {
        params: {
          email: Joi.string().email()
        }
      },
      tags: ['api'],
      description: 'Checks if email is already in use',
      response: {
        schema: Joi.object().keys({
          taken: Joi.boolean().required()
        }).required()
      },
      auth: false,
      plugins: {
        'hapi-swagger': {
          responses: {
            ' 200 ': {
              'description': 'Successful',
            }
          },
          payloadType: 'json'
        },
        yar: {
          skip: true
        }
      }
    }
  });

  //Reset password with email notification
  server.route({
    method: 'PUT',
    path: '/resetPassword',
    handler: handlers.resetPassword,
    config: {
      validate: {
        payload: {
          email: Joi.string().email(),
          language: Joi.string().length(5),
          APIKey: Joi.string().alphanum()
        }
      },
      tags: ['api'],
      description: 'Reset the password of a user using the email adress',
      auth: false,
      plugins: {
        'hapi-swagger': {
          responses: {
            ' 200 ': {
              'description': 'Successful - password reseted and email was send',
            },
            ' 403 ': {
              'description': 'Wrong APIKey was used',
            },
            ' 500 ': {
              'description': 'The action failed. Please try again.',
            },
            ' 404 ': {
              'description': 'The email is not used by a user.',
            },
            ' 401 ': {
              'description': 'User is deactivated.',
              'headers': {
                'WWW-Authenticate': {
                  'description': 'Contact the server admin in order to re-activate your account.'
                }
              }
            }
          },
          payloadType: 'json'
        },
        yar: {
          skip: true
        }
      }
    }
  });

  //Social logins

  //two hidden routes which are called by the OAuth process
  server.route({
    method: 'GET',
    path: '/social/provider/github',
    handler: function(req, res) {
      //Continue with the token
      //Remark: third parameter have to be the name of the provider as listet for purest
      handlers_social.handleOAuth2Token(req, res, 'github');
    }
  });
  server.route({
    method: 'GET',
    path: '/social/provider/google',
    handler: function(req, res) {
      handlers_social.handleOAuth2Token(req, res, 'google');
    }
  });

  server.route({
    method: 'PUT',
    path: '/social/provider',
    handler: handlers_social.addProvider,
    config: {
      validate: {
        payload: Joi.object().keys({
          username: Joi.string().alphanum(),
          email: Joi.string().email(),
          id: Joi.string(),
          language: Joi.string().length(5),
          provider: Joi.string(),
          location: Joi.string(),
          token: Joi.string()
        }).requiredKeys('username', 'id', 'provider', 'token'),
      },
      tags: ['api'],
      description: 'Add a new OAuth provider for the user - JWT needed',
      auth: 'jwt',
      plugins: {
        'hapi-swagger': {
          responses: {
            ' 200 ': {
              'description': 'Successful'
            },
            ' 401 ': {
              'description': 'Not authorized to add the provider.',
              'headers': {
                'WWW-Authenticate': {
                  'description': 'Use your JWT token.'
                }
              }
            },
            ' 404 ': {
              'description': 'Provider not available.'
            }
          },
          payloadType: 'form'
        },
        yar: {
          skip: true
        }
      }
    }
  });

  server.route({
    method: 'DELETE',
    path: '/social/provider',
    handler: handlers_social.deleteProvider,
    config: {
      validate: {
        params: {
          provider: Joi.string()
        },
        headers: Joi.object({
          '----jwt----': Joi.string().required().description('JWT header provided by /login')
        }).unknown()
      },
      tags: ['api'],
      description: 'Delete a OAuth provider - JWT needed',
      auth: 'jwt',
      plugins: {
        'hapi-swagger': {
          responses: {
            ' 200 ': {
              'description': 'Successful',
            },
            ' 401 ': {
              'description': 'Not authorized to delete the provider.',
              'headers': {
                'WWW-Authenticate': {
                  'description': 'Use your JWT token.'
                }
              }
            },
            ' 404 ': {
              'description': 'Provider for the user not found.'
            }
          },
          payloadType: 'form'
        },
        yar: {
          skip: true
        }
      }
    }
  });

  server.route({
    method: 'POST',
    path: '/social/register',
    handler: handlers_social.registerWithOAuth,
    config: {
      validate: {
        payload: Joi.object().keys({  //TODO rethink parameters
          id: Joi.string(),
          provider: Joi.string(),
          token: Joi.string(),
          scope: Joi.string(),
          expires: Joi.number(),
          token_creation: Joi.string(),//Date
          extra_token: Joi.string(),
          username: Joi.string().alphanum(),
          email: Joi.string().email(),
          language: Joi.string().length(5),
          organization: Joi.string(),
          description: Joi.string(),
          picture: Joi.string(),
          location: Joi.string(),
          name: Joi.string()
        }).requiredKeys('username', 'email', 'id', 'provider', 'token'),
      },
      tags: ['api'],
      description: 'Register a new user with the data from OAuth',
      response: {
        schema: Joi.object().keys({
          userid: Joi.number().integer()
        })
      },
      auth: false,
      plugins: {
        'hapi-swagger': {
          responses: {
            ' 200 ': {
              'description': 'Successful',
              'headers': {
                '----jwt----': {
                  'description': 'Contains the JWT'
                }
              },
              schema: Joi.object().keys({
                access_token: Joi.string(),
                expires_in: Joi.number(),
                userid: Joi.number().integer(),
                username: Joi.string()
              }).required()
            },
            ' 401 ': {
              'description': 'The credentials are wrong',
              'headers': {
                'WWW-Authenticate': {
                  'description': 'OAuth data is wrong or expired'
                }
              }
            },
            ' 422 ': {
              'description': 'Wrong user data - see error message',
              schema: Joi.object().keys({
                statusCode: Joi.number().integer(),
                error: Joi.string(),
                message: Joi.string()
              }).required()
            }
          },
          payloadType: 'form'
        },
        yar: {
          skip: true
        }
      }
    }
  });

  server.route({
    method: 'POST',
    path: '/social/login',
    handler: handlers_social.loginWithOAuth,
    config: {
      validate: {
        payload: Joi.object().keys({
          id: Joi.string(),
          provider: Joi.string(),
          token: Joi.string(),
          scope: Joi.string(),
          expires: Joi.number(),
          token_creation: Joi.string(),//Date
          extra_token: Joi.string(),
          email: Joi.string().email(),
          userid: Joi.number()
        }).requiredKeys('id', 'provider', 'token', 'email', 'userid')
      },
      tags: ['api'],
      description: 'Login with OAuth data',
      auth: false,
      plugins: {
        'hapi-swagger': {
          responses: {
            ' 200 ': {
              'description': 'Successful',
              'headers': {
                '----jwt----': {
                  'description': 'Contains the JWT'
                }
              },
              schema: Joi.object().keys({
                access_token: Joi.string(),
                expires_in: Joi.number(),
                userid: Joi.number().integer(),
                username: Joi.string()
              }).required()
            },
            ' 401 ': {
              'description': 'The credentials are wrong',
              'headers': {
                'WWW-Authenticate': {
                  'description': 'Send your JWT in the "----jwt----" and verify the provider data'
                }
              }
            }
          },
          payloadType: 'form'
        },
        yar: {
          skip: true
        }
      }
    }
  });
};
