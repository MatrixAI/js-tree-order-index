import ds from 'datascript';
import Reference from 'reference-pointer';

const db = ds.empty_db();

class DummyObj {}

const number = new Number(1);
const date = new Date;
const literalnestedobj = {};
const literalobj = {
  literalnestedobj: literalnestedobj,
  number: number,
  date: date
};
const referenceliteral = new Reference(literalobj);
const dummyobj = new DummyObj;
const nullobject = Object.create(null);
const nully = new Reference(null);
const uundefined = new Reference(undefined);

const db2 = ds.db_with(db, [{
  ':db/id': -1,
  'number': 1,
  'date': date,
  'literalobj': literalobj,
  'referenceliteral': referenceliteral,
  'dummyobj': dummyobj,
  'nullobject': nullobject,
  'nully': nully,
  'uundefined': uundefined
}]);

const conn = ds.conn_from_db(db2);

// const report = ds.transact(conn, [[':db.fn/retractEntity', 1]]);

const results = ds.transact(conn, [
  {
    ':db/id': -1,
    'number': 13424
  },
  {
    ':db/id': -2,
    'another': 13445
  }
]);

// console.log(ds.pull(ds.db(conn), '[*]', 2));

console.log(results);

console.log(ds.resolve_tempid(results.tempids, -2));

// forget about changing schema atm, it's kind of not important
// but it's a possibility to reload the db with the datoms with a new schema
// while also having to be able to change the tagger as well
// and also whether that would work with the type system
// that being of selecting a new node to work with

// const results = ds.q(
//   '[:find (pull ?e [*]) :in $ [?key ?value] :where [?e ?key ?value]]',
//   ds.db(conn),
//   ['number', 13424]
// );



// this gives a list of all datoms
// and entity, attribute value, t (transaction)?
// from here, we can actually create a new database with a new schema

// init_db(datoms, schema)
// conn_from_datoms(datoms, schema)
// so when chaning schema, you have to do this
// but it may not be successful
// so if you change schema, you have to do this extra thing
// most likely since we are keeping the db
// we would use

// const db = init_db(ds.datoms(this._db, ':eavt'), newSchema);
// and  use this db for reinitialising a new db


// const something = ds.datoms(ds.db(conn), ':eavt');

// console.log(something);


// console.log(report);

// oh shit, it actually gives each eav, instead of a single entity or anything
// so that's pointless
