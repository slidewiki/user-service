'use strict';

const co = require('../common');

module.exports = {
  'activities': {
    uri: (!co.isEmpty(process.env.SERVICE_URL_ACTIVITIES)) ? process.env.SERVICE_URL_ACTIVITIES : 'http://activitiesservice'
  },
  'platform': {
    uri: (!co.isEmpty(process.env.URL_PLATFORM)) ? process.env.URL_PLATFORM : 'http://localhost:3000'
  },
  'deck': {
    uri: (!co.isEmpty(process.env.SERVICE_URL_DECK)) ? process.env.SERVICE_URL_DECK : 'http://deckservice'
  }
};
