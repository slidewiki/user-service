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
    _id: objectid,
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
    username: {
      type: 'string'
    },
    email: {
      type: 'string'
    },
    picture: {
      type: 'string'
    },
    organization: {
      type: 'string'
    },
    name: {
      type: 'string'
    },
    location: {
      type: 'string'
    },
    identifier: {
      type: 'string'
    }
  },
  required: ['provider', 'token', 'token_creation', 'email', 'id']
};

//export
module.exports = ajv.compile(provider);
