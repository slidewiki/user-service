'use strict';

const co = require('../common');

module.exports = {
  'activities': {
    uri: (!co.isEmpty(process.env.SERVICE_URL_ACTIVITIES)) ? process.env.SERVICE_URL_ACTIVITIES : 'http://activitiesservice'
  },
  'platform': {
    uri: (!co.isEmpty(process.env.URL_PLATFORM)) ? process.env.URL_PLATFORM : 'http://platform'
  }
};
