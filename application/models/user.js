'use strict';

//require
let Ajv = require('ajv');
let ajv = Ajv({
  verbose: true,
  allErrors: true
  //v5: true  //enable v5 proposal of JSON-schema standard
}); // options can be passed, e.g. {allErrors: true}

//build schema
const objectid = {
  type: 'string',
  maxLength: 24,
  minLength: 24
};
const provider = {
  type: 'object',
  properties: {
    provider: {
      type: 'string'
    },
    token: {
      type: 'string'
    },
    expires: {
      type: 'number'
    },
    extra_token: {
      type: 'string'
    },
    scope: {
      type: 'string'
    },
    token_creation: {
      type: 'string',
      format: 'date-time'
    },
    id: {
      type: 'string'
    },
    identifier: {
      type: 'string'
    },
    email: {
      type: 'string'
    }
  },
  required: ['provider', 'token', 'token_creation']
};


const user = {
  type: 'object',
  properties: {
    _id: {
      type: 'integer'
    },
    email: {
      type: 'string',
      format: 'email'
    },
    username: {
      type: 'string'
    },
    password: {
      type: 'string'
    },
    defaults: {
      type: 'array',
      items: {
        type: 'object'
      }
    },
    registered: {
      type: 'string',
      format: 'date-time'
    },
    surname: {
      type: 'string'
    },
    forename: {
      type: 'string'
    },
    displayName: {
      type: 'string'
    },
    country: {
      type: 'string'
    },
    spokenLanguages: {
      type: 'array',
      items: {
        type: 'string'
      }
    },
    frontendLanguage: {
      type: 'string'
    },
    picture: {
      type: 'string'
    },
    interests: {
      type: 'string'
    },
    description: {
      type: 'string'
    },
    birthday: {
      type: 'string',
      format: 'date'
    },
    infodeck: {
      type: 'object',
      properties: {
        id: objectid,
        revision: {
          type: 'integer'
        }
      }
    },
    organization: {
      type: 'string'
    },
    deactivated: {
      type: 'boolean'
    },
    providers: {
      type: 'array',
      items: provider
    },
    authorised: {
      type: 'boolean'
    },
    reviewed: {
      type: 'boolean'
    },
    isReviewer: {
      type: 'boolean'
    },
    suspended: {
      type: 'boolean'
    },
    lastReviewDoneBy: {
      type: 'integer'
    }
  },
  required: ['email', 'username', 'frontendLanguage']
};

//export
module.exports = ajv.compile(user);
