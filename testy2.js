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
  'number': number,
  'date': date,
  'literalobj': literalobj,
  'referenceliteral': referenceliteral,
  'dummyobj': dummyobj,
  'nullobject': nullobject,
  'nully': nully,
  'uundefined': uundefined
}]);

const pulled = ds.pull(db2, '[*]', 1);

console.log(pulled);
/*
  { referenceliteral:
  Reference {
  _value:
  { literalnestedobj: {},
  number: [Number: 1],
  date: 2018-02-11T05:42:41.582Z } },
  nullobject: {},
  uundefined: Reference { _value: undefined },
  nully: Reference { _value: null },
  literalobj:
  { literalnestedobj: {},
  number: [Number: 1],
  date: 2018-02-11T05:42:41.582Z },
  number: [Number: 1],
  dummyobj: DummyObj {},
  ':db/id': 1,
  date: 2018-02-11T05:42:41.582Z }
*/

console.log(pulled.number === number);                                // true
console.log(pulled.date === date);                                    // true
console.log(pulled.literalobj === literalobj);                        // false
console.log(pulled.literalobj.literalnestedobj === literalnestedobj); // false
console.log(pulled.literalobj.number === number);                     // true
console.log(pulled.literalobj.date === date);                         // true
console.log(pulled.referenceliteral === referenceliteral);            // true
console.log(pulled.dummyobj === dummyobj);                            // true
console.log(pulled.nullobject === nullobject);                        // true
console.log(pulled.nully === nully);                                  // true
console.log(pulled.uundefined === uundefined);                        // true
