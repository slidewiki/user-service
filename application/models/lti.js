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
const ltikeys = {
  type: 'object',
  properties: {
    _id: {
      type: 'integer'
    },
    key: {
      type: 'string'
    },
    secret: {
      type: 'string'
    }
  },
  required: ['key', 'token', 'token_creation', 'id']
};

//export
module.exports = ajv.compile(ltiKeys);
