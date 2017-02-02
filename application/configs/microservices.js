'use strict';

const co = require('../common');

module.exports = {
  activities: {
    uri: (!co.isEmpty(process.env.URL_ACTIVITIESSERVICE)) ? process.env.URL_ACTIVITIESSERVICE : 'http://activitiesservice.experimental.slidewiki.org'
  },
  platform: {
    uri: (!co.isEmpty(process.env.URL_PLATFORM)) ? process.env.URL_PLATFORM : 'http://platform.experimental.slidewiki.org'
  }
};
