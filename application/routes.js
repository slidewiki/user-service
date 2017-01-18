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
            ' 404 ': {
              'description': 'No user for this credentials available.',
            },
            ' 423 ': {
              'description': 'The user is deactivated.',
            }
          },
          payloadType: 'form'
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
            ' 403 ': {
              'description': 'You are not allowed to get the private profile of another user.'
            },
            ' 404 ': {
              'description': 'User not found. Check the id.'
            },
            ' 423 ': {
              'description': 'The user is deactivated.'
            }
          },
          payloadType: 'form'
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
        }).requiredKeys('oldPassword', 'newPassword'),
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
            ' 403 ': {
              'description': 'Not possible to change the password of another user.',
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
        }
      }
    }
  });

  //gets dropdown data for frontend for users
  server.route({
    method: 'GET',
    path: '/information/username/search/{username}',
    handler: handlers.searchUser,
    config: {
      validate: {
        params: {
          username: Joi.string()
        }
      },
      tags: ['api'],
      description: 'Searches for user and returns JSON for semantic-ui dropdown',
      auth: false,
      plugins: {
        'hapi-swagger': {
          responses: {
            ' 200 ': {
              'description': 'Successful',
            }
          }
        }
      },
      cors: {
        origin: ['*'],
        additionalHeaders: ['cache-control', 'x-requested-with']
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
        }
      }
    }
  });

  //groups

  server.route({
    method: 'DELETE',
    path: '/usergroup/{groupid}',
    handler: handlers.deleteUsergroup,
    config: {
      validate: {
        params: {
          groupid: Joi.number().integer().options({convert: true})
        },
        headers: Joi.object({
          '----jwt----': Joi.string().required().description('JWT header provided by /login')
        }).unknown()
      },
      tags: ['api'],
      description: 'Delete a usergroup - JWT needed',
      auth: 'jwt',
      plugins: {
        'hapi-swagger': {
          responses: {
            ' 200 ': {
              'description': 'Successful',
            },
            ' 401 ': {
              'description': 'Not authorized to delete this group.',
              'headers': {
                'WWW-Authenticate': {
                  'description': 'Use your JWT token and the right groupid.'
                }
              }
            },
            ' 404 ': {
              'description': 'Group not found. Check the id.'
            }
          },
          payloadType: 'form'
        }
      }
    }
  });

  server.route({
    method: 'PUT',
    path: '/usergroup/{groupid}/leave',
    handler: handlers.leaveUsergroup,
    config: {
      validate: {
        params: {
          groupid: Joi.number().integer().options({convert: true})
        },
        headers: Joi.object({
          '----jwt----': Joi.string().required().description('JWT header provided by /login')
        }).unknown()
      },
      tags: ['api'],
      description: 'Leave a usergroup - JWT needed',
      auth: 'jwt',
      plugins: {
        'hapi-swagger': {
          responses: {
            ' 200 ': {
              'description': 'Successful',
            },
            ' 401 ': {
              'description': 'Not authorized.',
              'headers': {
                'WWW-Authenticate': {
                  'description': 'Use your JWT token and the right groupid.'
                }
              }
            },
            ' 404 ': {
              'description': 'Group not found. Check the id.'
            }
          },
          payloadType: 'form'
        }
      }
    }
  });

  server.route({
    method: 'PUT',
    path: '/usergroup/createorupdate',
    handler: handlers.createOrUpdateUsergroup,
    config: {
      validate: {
        payload: Joi.object().keys({
          id: Joi.number().optional().description('have to be empty for create'),
          name: Joi.string(),
          description: Joi.string().allow('').optional(),
          isActive: Joi.boolean().optional(),
          timestamp: Joi.string(),
          members: Joi.array().items(Joi.object().keys({
            userid: Joi.number(),
            joined: Joi.string(),
            username: Joi.string()
          }).requiredKeys('userid', 'joined'))
        }).requiredKeys('name'),
        headers: Joi.object({
          '----jwt----': Joi.string().required().description('JWT header provided by /login')
        }).unknown()
      },
      tags: ['api'],
      description: 'Update or create a usergroup - JWT needed',
      auth: 'jwt',
      plugins: {
        'hapi-swagger': {
          responses: {
            ' 200 ': {
              'description': 'Successful',
            },
            ' 401 ': {
              'description': 'Not authorized to update or create this usergroup.',
              'headers': {
                'WWW-Authenticate': {
                  'description': 'Use your JWT token and the right userid.'
                }
              }
            },
            ' 404 ': {
              'description': 'Group for update not found. Check the id.'
            },
            ' 422 ': {
              'description': 'Wrong usergroup data - see error message'
            }
          },
          payloadType: 'form'
        }
      }
    }
  });

  server.route({
    method: 'POST',
    path: '/usergroups',
    handler: handlers.getUsergroups,
    config: {
      validate: {
        payload: Joi.array().items(Joi.number())
      },
      tags: ['api'],
      description: 'Gets groups by ids',
      auth: false,
      plugins: {
        'hapi-swagger': {
          responses: {
            ' 200 ': {
              'description': 'Successful',
            }
          },
          payloadType: 'json'
        }
      }
    }
  });
};
