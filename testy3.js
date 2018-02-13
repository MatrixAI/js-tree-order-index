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

ds.transact(conn, [{
  ':db/id': 1,
  'number': 13424
}]);

const results = ds.q(
  '[:find (pull ?e [*]) :in $ [?key ?value] :where [?e ?key ?value]]',
  ds.db(conn),
  ['number', 13424]
);


console.log(results);


// console.log(report);

// oh shit, it actually gives each eav, instead of a single entity or anything
// so that's pointless
