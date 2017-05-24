'use strict';

const helper = require('./database/helper');

return helper.connectToDatabase()
  .then((db) => db.createCollection('users_duplications'))
  .then((collection) => collection.drop())
  .then((result) => {
    console.log('Got result from drop users_duplications:', result);
    return helper.connectToDatabase()
      .then((db) => db.createCollection('users_migrated'))
      .then((collection) => collection.drop())
      .then(() => {
        console.log('Got result from drop users_migrated:', result);
        return helper.connectToDatabase()
          .then((db) => db.collection('users'))
          .then((coll) => coll.mapReduce(function() {
            emit(this.username.toLowerCase().replace(/\s/g,''), this);
          },
            function(key, values) {
              return {
                count: values.length,
                username: key,
                users: values.reduce(function(prev, curr) {
                  if (curr.count)
                    prev.concat(curr.users);
                  else
                    prev.push(curr);
                  return prev;
                }, [])
              };
            },
            {out: 'users_duplications'}
          ))
          .then((result) => {
            console.log('Got result from first mapReduce:', result);
            return helper.connectToDatabase()
              .then((db) => db.collection('users_duplications'))
              .then((coll) => coll.mapReduce(function() {
                if (this.value.count === undefined) {
                  this.value.username = this.value.username.replace(/\s/g,'_');
                  emit(this.value._id, this.value);
                }
                else {
                  let i = 0;
                  this.value.users.forEach(function(user) {
                    let username = user.username.replace(/\s/g,'_');
                    for (let j = 0; j < i; j++) {
                      username = username+'ish';
                    }
                    i++;
                    user.username = username;
                    emit(user._id, user);
                  });
                }
              },
                function(key, values) {

                  return values;
                },
                {out: 'users_migrated'}
              ))
              .then((result) => {
                console.log('Got result from second mapReduce:', result);
                return helper.connectToDatabase()
                  .then((db) => db.collection('users'))
                  .then((collection) => collection.drop())
                  .then(() => {
                    return helper.connectToDatabase()
                      .then((db) => db.collection('users_migrated'))
                      .then((coll) => coll.aggregate([{ $replaceRoot: { newRoot: '$value' } },{ $out: 'users' }]))
                      .then((collection) => collection.toArray())
                      .then((result) => {
                        console.log('Finished!!! Got results from aggregate:', result.length);
                        return true;
                      });
                  });
              });
          });
      });
  })
  .catch((error) => {
    console.log('Error:', error);
  });

/*
db.users_duplications.drop()
db.users_migrated.drop()
db.runCommand(   {     mapReduce: 'users',     map: function() {       emit(this.username.toLowerCase().replace(/\s/g,''), this);     },     reduce: function(key, values) {        return {         count: values.length,         username: key,         users: values.reduce(function(prev, curr) {           if (curr.count)             prev.concat(curr.users);           else             prev.push(curr);           return prev;         }, [])       };     },     out: 'users_duplications'   } )
db.runCommand(   {     mapReduce: 'users_duplications',     map: function() {       if (this.value.count === undefined) {         this.value.username = this.value.username.replace(/\s/g,'_');         emit(this.value._id, this.value);       }       else {         let i = 0;         this.value.users.forEach(function(user) {           let username = user.username.replace(/\s/g,'_');           for (let j = 0; j < i; j++) {             username = username+'ish';           }           i++;           user.username = username;           emit(user._id, user);         });       }     },     reduce: function(key, values) {        return values;     },     out: 'users_migrated'   } )
db.users.drop()
db.users_migrated.aggregate([{ $replaceRoot: { newRoot: '$value' } },{ $out: 'users' }])
*/


/*
db.users.find({username: {$regex: /\s/g}})
db.runCommand(
  {
    mapReduce: 'users',
    map: function() {
      emit(this.username.toLowerCase().replace(/\s/g,''), this);
    },
    reduce: function(key, values) {

      return {
        count: values.length,
        username: key,
        users: values.reduce(function(prev, curr) {
          if (curr.count)
            prev.concat(curr.users);
          else
            prev.push(curr);
          return prev;
        }, [])
      };
    },
    out: 'users_duplications'
  }
)

db.runCommand(
  {
    mapReduce: 'users_duplications',
    map: function() {
      if (this.value.count === undefined) {
        this.value.username = this.value.username.replace(/\s/g,'_');
        emit(this.value._id, this.value);
      }
      else {
        let i = 0;
        this.value.users.forEach(function(user) {
          let username = user.username.replace(/\s/g,'_');
          for (let j = 0; j < i; j++) {
            username = username+'ish';
          }
          i++;
          user.username = username;
          emit(user._id, user);
        });
      }
    },
    reduce: function(key, values) {

      return values;
    },
    out: 'users_migrated'
  }
)
*/
