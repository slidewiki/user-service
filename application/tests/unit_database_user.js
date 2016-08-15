// example unit tests
'use strict';

//Mocking is missing completely TODO add mocked objects

describe('User service database', () => {

  let db, expect;

  beforeEach((done) => {
    //Clean everything up before doing new tests
    Object.keys(require.cache).forEach((key) => delete require.cache[key]);
    require('chai').should();
    let chai = require('chai');
    let chaiAsPromised = require('chai-as-promised');
    chai.use(chaiAsPromised);
    expect = require('chai').expect;
    db = require('../database/user.js');
    done();
  });

  const correct_user1 = {
      username: 'tboonx',
      forename: 'Kurt',
      surname: 'Junghanns',
      email: 'tboonx@gmail.com',
      password: '234729834782364826348623846284t374t',
      frontendLanguage: 'de',
      defaults: [{
        language: 'de'
      }]
    },
    wrong_user1 = {
      bla: 1,
      blub: 2,
      username: true,
      email: 4,
      password: false
    };
  let userid = '';

  context('Making CRUD on user collection - ', () => {
    it('Create with wrong data', () => {
      return db.create(wrong_user1)
        .then((result) => {
          //console.log(result);

          expect(result[0]).to.not.equal(undefined);
          expect(result[0]).to.not.equal(null);

          return;
        });
    });
    it('Create with correct data', () => {
      return db.create(correct_user1)
        .then((result) => {
          //console.log(result);

          expect(result.insertedId).to.not.equal(undefined);
          expect(result.insertedId).to.not.equal(null);
          expect(result.insertedCount).to.equal(1);

          userid = result.insertedId;

          return;
        });
    });
    it('Read', () => {
      return db.read(userid)
        .then((result) => { //user
          //console.log(result);

          expect(result._id).to.equal(userid);
          expect(result.email).to.equal(correct_user1.email);

          return;
        });
    });
    it('Update', () => {
      correct_user1._id = userid;
      correct_user1.username = 'FooBar';
      return db.update(correct_user1)
        .then((result) => {
          //console.log(result);

          expect(result.modifiedCount).to.equal(1);
          expect(result.ops[0].email).to.equal(correct_user1.email);

          return;
        });
    });
    it('Delete', () => {
      return db.delete(userid)
        .then((result) => {
          //console.log(result);

          expect(result.result.n).to.equal(1);

          return;
        });
    });
  });
});
