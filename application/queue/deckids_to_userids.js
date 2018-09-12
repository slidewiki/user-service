/* global db */
'use strict';

// mongo shell script to be used like mongo <database_name> < this_script.mogno
db.useridsforsuspension.insertMany(
  db.decks.distinct('user', {
    _id: { $in: db.deckidsforsuspension.distinct('_id') }
  }).map((u) => ( { _id: u } ) )
);
