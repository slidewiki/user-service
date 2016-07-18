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
const user = {
  type: 'object',
  properties: {
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
      format: 'date'
    },
    surname: {
      type: 'string'
    },
    forename: {
      type: 'string'
    },
    gender: {
      type: 'string',
      enum: ['male', 'female']
    },
    locale: {
      type: 'string'
    },
    hometown: {
      type: 'string'
    },
    location: {
      type: 'string'
    },
    languages: {
      type: 'array',
      items: {
        type: 'string'
      }
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
      type: 'object',
      properties: {
        year: {
          type: 'number'
        },
        month: {
          type: 'number'
        },
        day: {
          type: 'number'
        }
      }
    },
    infodeck: objectid
  },
  required: ['email', 'username']
};

//export
module.exports = ajv.compile(user);
