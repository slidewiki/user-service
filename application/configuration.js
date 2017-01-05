/* This module is used for confugrating the mongodb connection*/
'use strict';

//read mongodb URL from /etc/hosts
let host = 'localhost';
const fs = require('fs');
try {
  const lines = fs.readFileSync('/etc/hosts').toString().split('\n');
  for (let i in lines) {
    if (lines[i].includes('mongodb')) {
      const entrys = lines[i].split(' ');
      host = entrys[entrys.length - 1];
      console.log('Found mongodb host. Using ' + host + ' as database host.');
    }
  }
} catch (e) {
  //Windows or no read rights (bad)
}

//read mongo port from ENV
const co = require('./common');
let port = 27017;
if (!co.isEmpty(process.env.DATABASE_PORT)){
  port = process.env.DATABASE_PORT;
  //console.log('Using port ' + port + ' as database port.'); TODO replace it with logging, that isn't printed at npm run test:unit
}

//JWT serial
let JWTSerial = '69aac7f95a9152cd4ae7667c80557c284e413d748cca4c5715b3f02020a5ae1b';
if (!co.isEmpty(process.env.JWT_SERIAL)){
  JWTSerial = process.env.JWT_SERIAL;
}

let SMTP_port = 25,
  SMTP_host = 'localhost',
  SMTP_from = 'kjunghanns@informatik.uni-leipzig.de',
  SMTP_clientName = undefined;
if (!co.isEmpty(process.env.SMTP_PORT)){
  SMTP_port = process.env.SMTP_PORT;
}
if (!co.isEmpty(process.env.SMTP_HOST)){
  SMTP_host = process.env.SMTP_HOST;
}
if (!co.isEmpty(process.env.SMTP_FROM)){
  SMTP_from = process.env.SMTP_FROM;
}
if (!co.isEmpty(process.env.SMTP_CLIENTNAME)){
  SMTP_clientName = process.env.SMTP_CLIENTNAME;
}

let APIKey = '2cbc621f86e97189239ee8c4c80b10b3a935b8a9f5db3def7b6a3ae7c4b75cb5';
if (!co.isEmpty(process.env.APIKEY)){
  APIKey = process.env.APIKEY;
}

let url_notificationservice = 'http://notificationservice.experimental.slidewiki.org';
if (!co.isEmpty(process.env.URL_NOTIFICATIONSERVICE)){
  url_notificationservice = process.env.URL_NOTIFICATIONSERVICE;
}

let url_platform = 'http://platform.manfredfris.ch:4000';
if (!co.isEmpty(process.env.URL_PLATFORM)){
  url_platform = process.env.URL_PLATFORM;
}

module.exports = {
  MongoDB: {
    PORT: port,
    HOST: host,
    NS: 'local',
    SLIDEWIKIDATABASE: 'slidewiki'
  },
  JWT: {
    SERIAL: JWTSerial,
    HEADER: '----jwt----',
    ALGORITHM:  'HS512'
  },
  SMTP: {
    APIKey: APIKey,
    salt: '6cee6c6a420e0573d1a4ad8ecb44f2113d010a0c3aadd3c1251b9aa1406ba6a3',
    host: SMTP_host,
    port: SMTP_port,
    clientName: SMTP_clientName,
    from: SMTP_from
  },
  URLS: {
    notificationservice: url_notificationservice,
    platform: url_platform
  }
};
