'use strict';

let Ajv = require('ajv');
let ajv = Ajv({
  verbose: true,
  allErrors: true
  //v5: true  //enable v5 proposal of JSON-schema standard
}); // options can be passed, e.g. {allErrors: true}

const userlti = {
  type: 'object',
  properties: {
    _id: {
      type: 'integer'
    },
    key: {
      type: 'string'
    },
    timestamp: {
      type: 'string',
      format: 'date-time'
    },
    secret: {
      type: 'string'
    },
    isActive: {
      type: 'boolean'
    },
    creator: {
      type: 'object',
      properties: {
        userid: {
          type: 'integer'
        }
      },
      required: ['userid']
    },
    members: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          userid: {
            type: 'integer'
          },
          joined: {
            type: 'string',
            format: 'date-time'
          }
        },
        required: ['userid']
      }
    }
  },
  required: ['key', 'timestamp', 'creator']
};

module.exports = ajv.compile(userlti);
