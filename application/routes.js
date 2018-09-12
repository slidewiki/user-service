/*
Each route implementes a basic parameter/payload validation and a swagger API documentation description
*/
'use strict';

const Joi = require('joi'),
  handlers = require('./controllers/handler'),
  handlers_social = require('./controllers/handler_social'),
  handlers_lti = require('./controllers/handler_lti'),
  LANGUAGE_REGEX = /^\w{2,5}$/ , //better /^[a-z]{2}(?:-[A-Z]{2})?$/   ?
  USERNAME_REGEX = /^[\w\-.~_]*$/ ;

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
          username: Joi.string().regex(USERNAME_REGEX),
          email: Joi.string().email(),
          password: Joi.string().min(8).description('This string could be a plain password or a hash and have to be used on other routes as well, like /login and /resetpassword and /user/{id}/passwd'),
          language: Joi.string().regex(LANGUAGE_REGEX),
          organization: Joi.string()
        }).requiredKeys('username', 'email', 'password', 'language'),
      },
      tags: ['api'],
      description: 'Register a new user with unique username and email',
      response: {
        schema: Joi.object().keys({
          userid: Joi.number().integer(),
          secret: Joi.string().description('Used for the route /user/activate/{eail/{secret}}')
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
              }).required().description('Return schema')
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
    method: 'GET',
    path: '/user/activate/{email}/{secret}',
    handler: handlers.activateUser,
    config: {
      validate: {
        params: {
          secret: Joi.string(),
          email: Joi.string().email()
        }
      },
      tags: ['api'],
      description: 'Activate a user after registration',
      auth: false,
      plugins: {
        'hapi-swagger': {
          responses: {
            ' 200 ': {
              'description': 'Successful',
            },
            ' 403 ': {
              'description': 'Wrong credentials were used.',
              'headers': {
                'WWW-Authenticate': {
                  'description': 'Use the correct email plus secret and the right userid.'
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

  //Login with credentials
  server.route({
    method: 'POST',
    path: '/login',
    handler: handlers.login,
    config: {
      validate: {
        payload: Joi.object().keys({
          email: Joi.string().email(),
          password: Joi.string().description('Password set via /register or /resetPassword or  and /user/{id}/passwd')
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
                username: Joi.string(),
                displayName: Joi.string()
              }).required().description('Return schema')
            },
            ' 403 ': {
              'description': 'The user is marked as SPAM.',
            },
            ' 404 ': {
              'description': 'No user for this credentials available.',
            },
            ' 423 ': {
              'description': 'The user is deactivated.',
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
          id: Joi.number().integer().options({convert: true}).min(1)
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
            ' 403 ': {
              'description': 'You cannot delete another user.'
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
          newPassword: Joi.string().min(8).description('This password could be a plain password or a hash and have to be used on other routes as well, like /login and /resetpassword')
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
          email: Joi.string().email().required(),
          username: Joi.string().regex(USERNAME_REGEX),
          surname: Joi.string().allow('').optional(),
          forename: Joi.string().allow('').optional(),
          //sex: Joi.string(),  //not used right now
          language: Joi.string().regex(LANGUAGE_REGEX),
          country: Joi.string().allow('').optional(),
          picture: Joi.string().uri().allow('').optional(),
          description: Joi.string().allow('').optional(),
          organization: Joi.string().allow('').optional(),
          displayName: Joi.string().allow('').optional()
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
            ' 403 ': {
              'description': 'You are not allowed to do this.'
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
            },
            ' 423 ': {
              'description': 'This user is deactivated.'
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
          username: Joi.string().regex(USERNAME_REGEX)
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

  //gets dropdown data for frontend for users
  server.route({
    method: 'GET',
    path: '/information/username/search/{term?}',
    handler: handlers.searchUser,
    config: {
      validate: {
        params: {
          term: Joi.string().allow('').optional()
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
          email: Joi.string().email().trim().required()
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
          language: Joi.string().regex(LANGUAGE_REGEX),
          APIKey: Joi.string().alphanum().description('Client specific key. Is needed to use this route.'),
          salt: Joi.string().allow('').optional().description('When this parameter is given, then the service assumes that the client will hash the users plaintext password with SHA-512(password + salt). The salt and algorithm should not be changed in a client, because then the via this route created password will not work after such a change.')
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
          payloadType: 'form'
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
    method: 'GET',
    path: '/social/provider/facebook',
    handler: function(req, res) {
      handlers_social.handleOAuth2Token(req, res, 'facebook');
    }
  });

  server.route({
    method: 'PUT',
    path: '/social/provider/{provider}',
    handler: handlers_social.addProvider,
    config: {
      validate: {
        params: {
          provider: Joi.string()
        },
        payload: Joi.object().keys({
          identifier: Joi.string(),
          provider: Joi.string(),
          token: Joi.string(),
          token_creation: Joi.string(),//Date
          email: Joi.string().email(),
          language: Joi.string().regex(LANGUAGE_REGEX)
        }).requiredKeys('email', 'identifier', 'provider', 'token', 'token_creation'),
        headers: Joi.object({
          '----jwt----': Joi.string().required().description('JWT header provided by /login')
        }).unknown()
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
                  'description': 'Use your JWT token and send the right OAuth data.'
                }
              }
            },
            ' 404 ': {
              'description': 'User of JWT was not found'
            },
            ' 406 ': {
              'description': 'Provider is not available.'
            },
            ' 409 ': {
              'description': 'The account of the social provider is already used. Normally by another account. Check if you have multiple accounts.'
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
    path: '/social/provider/{provider}',
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
            },
            ' 406 ': {
              'description': 'Provider is not available.'
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
        payload: Joi.object().keys({
          identifier: Joi.string(),
          provider: Joi.string(),
          token: Joi.string(),
          scope: Joi.string(),
          token_creation: Joi.string(),//Date
          username: Joi.string().regex(USERNAME_REGEX),
          email: Joi.string().email(),
          language: Joi.string().regex(LANGUAGE_REGEX),
          forename: Joi.string(),
          surname: Joi.string()
        }).requiredKeys('username', 'email', 'identifier', 'provider', 'token', 'token_creation'),
      },
      tags: ['api'],
      description: 'Register a new user with the data from OAuth',
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
              }).required().description('Return schema')
            },
            ' 401 ': {
              'description': 'The credentials are wrong',
              'headers': {
                'WWW-Authenticate': {
                  'description': 'OAuth data is wrong or expired'
                }
              }
            },
            ' 406 ': {
              'description': 'Provider is not available.'
            },
            ' 409 ': {
              'description': 'Provider data is already in use by another user.'
            },
            ' 422 ': {
              'description': 'Wrong user data - see error message',
              schema: Joi.object().keys({
                statusCode: Joi.number().integer(),
                error: Joi.string(),
                message: Joi.string()
              }).required().description('Return schema')
            },
            ' 423 ': {
              'description': 'The user with this provider assigned is deactivated.'
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
          identifier: Joi.string(),
          provider: Joi.string(),
          token: Joi.string(),
          scope: Joi.string(),
          token_creation: Joi.string(), //Date
          email: Joi.string().email(),  //email of provider
          language: Joi.string().regex(LANGUAGE_REGEX)
        }).requiredKeys('identifier', 'provider', 'token', 'token_creation', 'email')
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
                username: Joi.string(),
                displayName: Joi.string()
              }).required().description('Return schema')
            },
            ' 401 ': {
              'description': 'The credentials are wrong',
              'headers': {
                'WWW-Authenticate': {
                  'description': 'Wrong userdata or oauth data. Either you have to register or you check the request parameters.'
                }
              }
            },
            ' 403 ': {
              'description': 'The user is marked as SPAM.',
            },
            ' 406 ': {
              'description': 'Provider is not available.'
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
    method: 'GET',
    path: '/social/providers/{id}',
    handler: handlers_social.getProvidersOfUser,
    config: {
      validate: {
        params: {
          id: Joi.number().integer().options({convert: true}).description('Id of the user')
        },
        headers: Joi.object({
          '----jwt----': Joi.string().required().description('JWT header provided by /login')
        }).unknown()
      },
      tags: ['api'],
      description: 'Returns array of already used providers of the user - JWT needed',
      auth: 'jwt',
      plugins: {
        'hapi-swagger': {
          responses: {
            ' 200 ': {
              'description': 'Successful',
            },
            ' 401 ': {
              'description': 'Not authorized',
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

  //LTI
  server.route({
    method: 'POST',
    path: '/lti/handle/{resource_id}',
    handler: handlers_lti.handleLTI,
    config: {
      validate: {
        payload: Joi.object().keys({
          oauth_consumer_key: Joi.string(),
          oauth_timestamp: Joi.string(),
          oauth_signature_method: Joi.string(),
          oauth_signature: Joi.string(),
          oauth_version: Joi.string(),
          ext_user_username: Joi.string(),
          lis_person_contact_email_primary: Joi.string().email(),
          lis_person_name_given: Joi.string().allow(''),
          lis_person_name_family: Joi.string().allow(''),
          oauth_nonce: Joi.string().allow(''),
          ext_lms: Joi.string().allow(''),
          lis_result_sourcedid: Joi.string().allow(''),
          context_id: Joi.string().allow(''),
          tool_consumer_info_version: Joi.string().allow(''),
          tool_consumer_instance_guid: Joi.string().allow(''),
          context_label: Joi.string().allow(''),
          lti_message_type: Joi.string().allow(''),
          lis_person_name_full: Joi.string().allow(''),
          context_title: Joi.string().allow(''),
          user_id: Joi.string().allow(''),
          tool_consumer_instance_description: Joi.string().allow(''),
          launch_presentation_locale: Joi.string().allow(''),
          resource_link_description: Joi.string().allow(''),
          lis_outcome_service_url: Joi.string().allow(''),
          tool_consumer_info_product_family_code: Joi.string().allow(''),
          oauth_callback: Joi.string().allow(''),
          lis_course_section_sourcedid: Joi.string().allow(''),
          lis_person_sourcedid: Joi.string().allow(''),
          tool_consumer_instance_name: Joi.string().allow(''),
          resource_link_id: Joi.string().allow(''),
          resource_link_title:Joi.string().allow(''),
          roles: Joi.string().allow(''),
          context_type: Joi.string().allow(''),
          lti_version: Joi.string().allow(''),
          launch_presentation_return_url: Joi.string().allow(''),
          launch_presentation_document_target: Joi.string().allow('')
        }).requiredKeys('ext_user_username', 'oauth_consumer_key', 'oauth_signature', 'oauth_timestamp', 'oauth_signature_method', 'oauth_version'),
        //.requiredKeys('ext_user_username', 'oauth_consumer_key', 'oauth_signature', 'oauth_timestamp', 'oauth_signature_method', 'oauth_version'),
      },
      state: {
        parse: true, // parse and store in request.state
        failAction: 'error' // may also be 'ignore' or 'log'
      },
      tags: ['api'],
      description: 'Register a new user via LTI',
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
              }).required().description('Return schema')
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
              }).required().description('Return schema')
            },
            ' 423 ': {
              'description': 'This LTI user is deactivated'
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
          timestamp: Joi.string().allow('').optional(),
          members: Joi.array().items(Joi.object().keys({
            userid: Joi.number(),
            joined: Joi.string().allow('').optional()
          }).requiredKeys('userid')),
          referenceDateTime: Joi.string().allow('').optional(),
          picture: Joi.string().uri().allow('').optional()
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
          payloadType: 'json'
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


  //ltis
    server.route({
      method: 'POST',
      path: '/userltis',
      handler: handlers.getUserltis,
      config: {
        validate: {
          payload: Joi.array().items(Joi.number())
        },
        tags: ['api'],
        description: 'Gets ltis by ids',
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

      server.route({
        method: 'PUT',
        path: '/userlti/createorupdate',
        handler: handlers.createOrUpdateUserlti,
        config: {
          validate: {
            payload: Joi.object().keys({
              id: Joi.number().optional().description('have to be empty for create'),
              key: Joi.string(),
              secret: Joi.string().allow('').optional(),
              isActive: Joi.boolean().optional(),
              timestamp: Joi.string().allow('').optional(),
              members: Joi.array().items(Joi.object().keys({
                userid: Joi.number(),
                joined: Joi.string().allow('').optional()
              }).requiredKeys('userid')),
              referenceDateTime: Joi.string().allow('').optional()
            }).requiredKeys('key'),
            headers: Joi.object({
              '----jwt----': Joi.string().required().description('JWT header provided by /login')
            }).unknown()

          },
          tags: ['api'],
          description: 'Update or create a userlti - JWT needed',
          auth: 'jwt',
          plugins: {
            'hapi-swagger': {
              responses: {
                ' 200 ': {
                  'description': 'Successful',
                },
                ' 401 ': {
                  'description': 'Not authorized to update or create this userlti.',
                  'headers': {
                    'WWW-Authenticate': {
                      'description': 'Use your JWT token and the right userid.'
                    }
                  }
                },
                ' 404 ': {
                  'description': 'LTI for update not found. Check the id.'
                },
                ' 422 ': {
                  'description': 'Wrong userlti data - see error message'
                }
              },
              payloadType: 'json'
            }
          }
        }

      });



      server.route({
        method: 'DELETE',
        path: '/userlti/{ltiid}',
        handler: handlers.deleteUserlti,
        config: {
          validate: {
            params: {
              ltiid: Joi.number().integer().options({convert: true})
            },
            headers: Joi.object({
              '----jwt----': Joi.string().required().description('JWT header provided by /login')
            }).unknown()
          },
          tags: ['api'],
          description: 'Delete a userlti - JWT needed',
          auth: 'jwt',
          plugins: {
            'hapi-swagger': {
              responses: {
                ' 200 ': {
                  'description': 'Successful',
                },
                ' 401 ': {
                  'description': 'Not authorized to delete this lti.',
                  'headers': {
                    'WWW-Authenticate': {
                      'description': 'Use your JWT token and the right ltiid.'
                    }
                  }
                },
                ' 404 ': {
                  'description': 'LTI not found. Check the id.'
                }
              },
              payloadType: 'form'
            }
          }
        }
      });

  // Routes for other services

  server.route({
    method: 'GET',
    path: '/userdata',
    handler: handlers.getUserdata,
    config: {
      validate: {
        headers: Joi.object({
          '----jwt----': Joi.string().required().description('JWT header provided by /login')
        }).unknown()
      },
      tags: ['api'],
      description: 'Get information about the logged in user - JWT needed',
      response: {
        schema: Joi.object().keys({
          id: Joi.number().required(),
          username: Joi.string().required(),
          groups: Joi.array().items(Joi.object().keys({
            _id: Joi.number(),
            name: Joi.string(),
            creator: Joi.number(),
            members: Joi.array().items(Joi.object().keys({
              userid: Joi.number(),
              joined: Joi.string()
            }).requiredKeys('userid', 'joined'))
          }).requiredKeys('_id', 'name', 'creator')),

          ltis: Joi.array().items(Joi.object().keys({
            _id: Joi.number(),
            key: Joi.string(),
            secret: Joi.string(),
            creator: Joi.number(),
            members: Joi.array().items(Joi.object().keys({
              userid: Joi.number(),
              joined: Joi.string()
            }).requiredKeys('userid', 'joined'))
          }).requiredKeys('_id', 'key', 'secret', 'creator'))

        }).required('id', 'username')
/*
        ltis: Joi.array().items(Joi.object().keys({
          _id: Joi.number(),
          key: Joi.string(),
          secret: Joi.string(),
          creator: Joi.number(),
          members: Joi.array().items(Joi.object().keys({
            userid: Joi.number(),
            joined: Joi.string()
          }).requiredKeys('userid', 'joined'))
        }).requiredKeys('_id', 'name', 'creator'))
      }).required('id', 'username')
*/
      },
      auth: 'jwt',
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

  server.route({
    method: 'POST',
    path: '/users',
    handler: handlers.getUsers,
    config: {
      validate: {
        payload: Joi.array().items(Joi.number())
      },
      tags: ['api'],
      description: 'Get users by ids (public data)',
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

  server.route({
    method: 'POST',
    path: '/user/{id}/sendEmail',
    handler: handlers.sendEmail,
    config: {
      validate: {
        params: {
          id: Joi.number().integer().options({convert: true})
        },
        payload: {
          reason: Joi.number(),
          data: Joi.object().unknown()
        }
      },
      tags: ['api'],
      description: 'Sends an email to the user with the given userid. The reason determines the text of the email and the data object contains any keys (one level) used for the email text.',
      auth: 'jwt',
      plugins: {
        'hapi-swagger': {
          responses: {
            ' 200 ': {
              'description': 'Successful',
            },
            ' 401 ': {
              'description': 'No authentification given.',
              'headers': {
                'WWW-Authenticate': {
                  'description': 'Use your JWT token and secret.'
                }
              }
            },
            ' 404 ': {
              'description': 'User or reason not found. Check the id of user and reason.'
            }
          },
          payloadType: 'json'
        }
      }
    }
  });

  //Routes for SPAM protection

  server.route({
    method: 'POST',
    path: '/user/{id}/suspend',
    handler: handlers.suspendUser,
    config: {
      validate: {
        params: {
          id: Joi.number().integer().options({convert: true})
        },
        query: {
          secret: Joi.string()
        },
        headers: Joi.object({
          '----jwt----': Joi.string().required().description('JWT header provided by /login')
        }).unknown()
      },
      tags: ['api'],
      description: 'Suspends a user which is in review state. Side effect is that all the decks of the user also gets suspended',
      auth: 'jwt',
      plugins: {
        'hapi-swagger': {
          responses: {
            ' 200 ': {
              'description': 'Successful',
            },
            ' 401 ': {
              'description': 'No authentification given.',
              'headers': {
                'WWW-Authenticate': {
                  'description': 'Use your JWT token and secret.'
                }
              }
            },
            ' 403 ': {
              'description': 'Not authorized to suspend a user - no reviewer or wrong secret.'
            },
            ' 404 ': {
              'description': 'User not found. Check the id and state of the user.'
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

  server.route({
    method: 'PATCH',
    path: '/user/{id}/approve',
    handler: handlers.approveUser,
    config: {
      validate: {
        params: {
          id: Joi.number().integer().options({convert: true})
        },
        query: {
          secret: Joi.string()
        },
        headers: Joi.object({
          '----jwt----': Joi.string().required().description('JWT header provided by /login')
        }).unknown()
      },
      tags: ['api'],
      description: 'Approves a user which is in review state',
      auth: 'jwt',
      plugins: {
        'hapi-swagger': {
          responses: {
            ' 200 ': {
              'description': 'Successful',
            },
            ' 401 ': {
              'description': 'No authentification given.',
              'headers': {
                'WWW-Authenticate': {
                  'description': 'Use your JWT token and secret.'
                }
              }
            },
            ' 403 ': {
              'description': 'Not authorized to approve a user - no reviewer or wrong secret.'
            },
            ' 404 ': {
              'description': 'User not found. Check the id and state of the user.'
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

  server.route({
    method: 'GET',
    path: '/reviewqueue',
    handler: handlers.getNextReviewableUser,
    config: {
      validate: {
        headers: Joi.object({
          '----jwt----': Joi.string().required().description('JWT header provided by /login')
        }).unknown(),
        query: {
          secret: Joi.string()
        },
      },
      tags: ['api'],
      description: 'Get the next reviewable user. As side effect the used queue gets narrowed by one',
      response: {
        schema: Joi.object().keys({
          userid: Joi.number().required(),
          username: Joi.string().required(),
          decks: Joi.number().required(),
          addedByReviewer: Joi.number().required()
        }).required()
      },
      auth: 'jwt',
      plugins: {
        'hapi-swagger': {
          responses: {
            ' 200 ': {
              'description': 'Successful',
            },
            ' 401 ': {
              'description': 'No authentification given.',
              'headers': {
                'WWW-Authenticate': {
                  'description': 'Use your JWT token and secret.'
                }
              }
            },
            ' 403 ': {
              'description': 'Not authorized to get the next rewiewable user - no reviewer or wrong secret.'
            },
            ' 404 ': {
              'description': 'There is no more user left in the queue.'
            }
          },
          payloadType: 'json'
        }
      }
    }
  });

  server.route({
    method: 'POST',
    path: '/reviewqueue/{id}',
    handler: handlers.addToQueue,
    config: {
      validate: {
        params: {
          id: Joi.number().integer().options({convert: true})
        },
        query: {
          secret: Joi.string(),
          decks: Joi.number().optional()
        },
        headers: Joi.object({
          '----jwt----': Joi.string().required().description('JWT header provided by /login')
        }).unknown()
      },
      tags: ['api'],
      description: 'Adds a user to the queue (have to be a user which was already there)',
      auth: 'jwt',
      plugins: {
        'hapi-swagger': {
          responses: {
            ' 200 ': {
              'description': 'Successful',
            },
            ' 401 ': {
              'description': 'No authentification given.',
              'headers': {
                'WWW-Authenticate': {
                  'description': 'Use your JWT token and secret.'
                }
              }
            },
            ' 403 ': {
              'description': 'Not authorized to add a user to the queue - no reviewer or wrong secret.'
            },
            ' 404 ': {
              'description': 'User not found. Check the id and state of the user.'
            },
            ' 409 ': {
              'description': 'The user was already reviewed.'
            },
            ' 423 ': {
              'description': 'The user is deactivated or not already activated.',
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
};
