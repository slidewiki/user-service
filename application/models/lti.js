'use strict';

//require
let Ajv = require('ajv');
let ajv = Ajv({
  verbose: true,
  allErrors: true
  //v5: true  //enable v5 proposal of JSON-schema standard
}); // options can be passed, e.g. {allErrors: true}


const ltiKeys = {
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
  //required: ['key', 'secret', 'id']
  required: ['key', 'secret', 'id']
};


//export
module.exports = ajv.compile(ltiKeys);
