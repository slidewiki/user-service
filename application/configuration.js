/* This module is used for configurating the mongodb connection*/
'use strict';

const co = require('./common.js');

let host = 'localhost';
//read mongo URL from /etc/hosts
const fs = require('fs');
try {
  const lines = fs.readFileSync('/etc/hosts').toString().split('\n');
  lines.filter((line) => line.includes('mongodb')).forEach((line) => {
    const entries = line.split(' ');
    host = entries[entries.length - 1];
    console.log('Using ' + host + ' as database host.');
  });
} catch (e) {
  console.log('Exception: Windows or no read rights to read /etc/hosts (bad)');
}
//read mongo URL from ENV
host = (!co.isEmpty(process.env.DATABASE_URL)) ? process.env.DATABASE_URL : host;
if(host !== 'localhost')
  console.log('Using ' + host + ' as database host.');

let port = 27017;
//read mongo port from ENV
if (!co.isEmpty(process.env.DATABASE_PORT)){
  port = process.env.DATABASE_PORT;
  console.log('Using ' + port + ' as database port.');
}

//JWT serial
let JWTSerial = '69aac7f95a9152cd4ae7667c80557c284e413d748cca4c5715b3f02020a5ae1b';
if (!co.isEmpty(process.env.JWT_SERIAL)){
  JWTSerial = process.env.JWT_SERIAL;
}

//STMP variables
let SMTP_port = 25,
  SMTP_host = 'localhost',
  SMTP_from = 'kjunghanns@informatik.uni-leipzig.de',
  SMTP_clientName = undefined,
  SMTP_enabled = true;
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
if (!co.isEmpty(process.env.SMTP_ENABLED)){
  SMTP_enabled = process.env.SMTP_ENABLED === true || process.env.SMTP_ENABLED === 'true';
}

let APIKey = '2cbc621f86e97189239ee8c4c80b10b3a935b8a9f5db3def7b6a3ae7c4b75cb5';
if (!co.isEmpty(process.env.APIKEY)){
  APIKey = process.env.APIKEY;
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
    host: SMTP_host,
    port: SMTP_port,
    clientName: SMTP_clientName,
    from: SMTP_from,
    enabled: SMTP_enabled
  },
  SALT: '6cee6c6a420e0573d1a4ad8ecb44f2113d010a0c3aadd3c1251b9aa1406ba6a3' //must be the same as in slidewiki-platform, see handler.js resetPassword
};
