#!/bin/bash
mongoimport --collection deckidsforsuspension --mode upsert --type csv --fields _id -d $1 $2
mongo $1 < deckids_to_userids.js
