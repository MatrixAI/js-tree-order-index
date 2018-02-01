// we need to get flow types exported from here, and make sure the NodeTableInterface is exported outside so that we can use databases to represent a tree
// any thing that supports relational access to aspects of the node
// but also wait...
// one would directly access the tree index to manipulate the tree
// but that means something is supporting fast operations to the node records
// the user must not then be manipulating the tree directly, nor should they be directly manipulating the nodes either
// and then we don't actually save the tree either, because it's been totally encoded

Entry into the order index tree needs to be a cursor when referring to those methods of the order index interface.

This means the entry must be an interface. Since it actually relies on the links.

The links themselves are actually the cursors into the tree. Since we don't have pointers between the tree.

That is, B+tree represents a mix between implicit and explicit data structure. It is explicit with pointers between blocks (and between inner blocks and leaf blocks) and also parent pointers. But's implicit with regards to the actual entries within a leaf block.

So entries are just arrays. Arrays that are not meant to be dynamic, that is they are meant to be fixed size. I'm not sure whether this really means anything in JS, but we can prealloate arrays for this purpose.

Ok so we should be using an interface for OrderLink.

---

Have to figure out how to implement node insertion with regards to BOTree, the way I understand it is with entry pair, opening and closing that gets inserted, since we represent an interval with an entry pair.

GapKeys can be abstraced away into a sort of GapKeyArray that supplies all the gapkey functionality. Of course the issue is that gaplinks rely on the gapkeyarray concept, but we can say that if our links are implemented with gaplinks, then this also means the usage of the gapkeyarray. Yea no problem with that, we're not saying BOTree is a generic structure, we are just saying that it implements a generic interface, where we specify that we use gaplinks and internally also use the gapkeyarray.

Furthermore we need to create a function that given a gaplink, we find another gaplink. That is given the opening gaplink, we get the corresponding gaplink. This is necessary for immediate child traversal, since you need to traverse to the correct immediate child before you can insert there.

---

We are now rewriting some of the types to be more easily understood so we don't have functionality embedded with the data, but separate the data into just object structures with typing by flow, and the functionality into just the BOTree class. This means we are taking advantage of immutability by using Object.seal and Object.freeze where it's useful.

Oh and in doing so, we are dealing with the fact that we want a fixed size array that maintains the true count of the number of elements across a few special mutation methods. This would actually allow us to use immutability with Object.freeze, but it would also mean we have to use `{...existingObj, redefinition: ...}`. Does this actually maintain structural sharing? I don't know. It would if the pointers to the old objects are still there. Remember this means we are mutating the array specifically. In fact we don't even do this. Wait we can't actually use `{...}`, becuase we have a class, not a normal object right? Wait this is a object rest spread transform.

Oh shit it actually works, you can totally do with normal objects as long as it is an enumerated property.

Also you have to define how splicing actually works.
Since you don't have direct access to the array, you have to define what it means to splice.
Well you actually just delete elements.
But you may need a temporary resizing, and make sure the size is set back to what it was, this way you can do this kind of insertion.
Remember after each one, you need to perform updating the cursors, or gaplinks if necessary.

---

Replace block like arrays with a red black tree, as we can more easily insert in between. OR... we should use a splice like notation.

OR use opportunistic insertion?

The point with a array fixed is that you can more easily insert next to it, instead of a red black tree. But with that you need interpolation search. And you may have to deal with sparse arrays. So you're dealing with a truly sparse array, and you cannot easily split like you can with array fixed.

Add in functions to ArrayFixed as you need them.

---

We can use datascript as the underlying NodeTable.

It is immutable and it has a JS interface and it has indexing and it's based on row/col usage.


```js
const db = d.empty_db();

const db1 = d.db_with(db, [[':db/add', 1, 'name', 'Ivan'], [':db/add', 1, 'age', 17]]);

let q;

q = '[:find ?e ?n ?a :where [?e "name" ?n] [?e "age" ?a]]';

d.q(q, db1); // this gives us [[1, 'Ivan', 17]]

q = '[:find ?e ?n ?a :where [?e "name" ?n] [?e "age" ?a] [?e "age" 17]]';

d.q(q, db1); // this gives us [[1, 'Ivan', 17]] (here we have an extra constraint which is that age is 17, but that ?a is also 17)
// usually you wouldn't ask for ?a given you have set that age is 17
// why ask for age again?
// but if you really do want to ask you have to unify it
// not sure how you do a select * on it though

const db2 = d.db_with(db1, [{
  ':db/id': 2,
  'name': 'Igor',
  'age': 35
}
]);
```

So what this does seems like we start with an empty db, and then from there add in new data.

We add in something like `1, name, Ivan`, indicating that our entity id is 1, but it has a key and value being name = Ivan.

If we ask for `db` instead, it will return an empty array, as no nodes are there.

But the query is a bit strange, it asks for find `?n ?a` and where `?n` is fileld via `[?e 'name' ?n]`.

```
[:db/add "foo" :db/ident :green]
```

Means an assertion, it adds a single atomic fact to Datomic. Assertions is represented by ordinary data structures. `"foo"` is the entity id. `:db/ident` is an attribute, and `:green` is the value.

Ok that's just an assertion, so with multiple assertions, we are saying to insert a fact that entity 1 has name Ivan and age 17.

What about `init_db`?

If you do `[:find ?e :where [?e 'age' 17]]`, you get back just `[[1]]`. Meaning it's just the id value. THe `?e` refers to the ID. But I'm not sure how to get everything just by the id.

How do you get by the entity id!?

You can request a new entity ids by specifying a temporary (tempid) in the transaction data. The `Peer.tempid` method creates a new tempid and the `Peer.resolveTempid` method cdan be used to interrogate a transaction return value for the actual id assigned.

Suppose you ask for a temp id, if you never use it, is there some way to make sure that the id gets returned? The only way to do this is to hook into the GC. But we can't do that easily since JS doesn't have that, instead it has to be explicit.

This is how you get all the entries for a given id:

```
d.pull(db, '[*]', 1);
```

Which returns `{':db/id': 1, age: 35, name: 'Igor'}`.

This is not the same api as the `d.q` queries however. And this pulls everything.

To pull specific ones:

```
d.pull(db, '["name"]', 1);
```

There you go!

```

d.q('[:find ?e ?n ?a :where [?e "name" ?n] [?e "age" ?a]]', db);
d.pull(db, '["name"]', 1);
d.pull(db, '[*]', 1);
d.q('[:find ?e :where [?e]]', db); // gives you all the ids
d.q('[:find (pull ?e [*]) :where [?e]]', db); // gives you all the objects for the constraints (combined pull + query filter)
d.q('[:find (pull ?e ["name"]) :where [?e]]', db); // gives you only the name in this case

// gets the name where entity is 1 (passed in)
d.q('[:find ?n :in $ ?e :where [?e "name" ?n]]', db3, 1);

// gets the entity where age is 17 (passed in)
d.q('[:find ?e :in $ ?age :where [?e "age" ?age]]', db3, 17);

// gets entity and name
d.q('[:find ?e ?n :in $ ?age :where [?e "name" ?n] [?e "age" ?age]]', db3, 17);

// gets everything for the node that is 17
d.q('[:find (pull ?e [*]) :in $ ?age :where [?e "age" ?age]]', db3, 17);

const date1 = new Date();
const date2 = new Date();
const db4 = d.db_with(db3, [[':db/add', 1, 'date', date1], [':db/add', 2, 'date', date2]]);
// now entity 1 has date1, while entity2 has date2
// now we run a query to check against it

d.q('[:find (pull ?e [*]) :in $ ?date :where [?e "date" ?date]]', db4, date1);
```

It works:

```
const d = require('datascript');
class DummyObj {
  constructor (a, b) {
    this.a = a;
    this.b = b;
  }
}

const obj1 = new DummyObj(2, 1);
const obj2 = new DummyObj(1, 1);


const db = d.empty_db();
const db1 = d.db_with(db, [[':db/add', 1, 'obj', obj1], [':db/add', 2, 'obj', obj2]]);

d.q('[:find (pull ?e [*]) :in $ ?obj :where [?e "obj" ?obj]]', db1, obj1); // only entity 1
d.q('[:find (pull ?e [*]) :in $ ?obj :where [?e "obj" ?obj]]', db1, obj2); // only entity 2
```

It may not work properly with normal objects though: https://github.com/tonsky/datascript/issues/248

How to setup indexing now. And what about temporary ids? Weakmaps with keys as objects. The object is the returned temporary id. When that object is GCed, the weakmap no longer has it. Basically now you can resuse that id. Note that what is that id? Well that value of the key in this case is whether it has a particular id value or not? Actually that makes no sense, how would you then make sure you can reuse ids that were never used? You need a resource counter, but this requires explicit deallocation. Yea I think it just has to be explicit. That's all. We can combine this with resource-counter, or maybe entity ID temporary id from datascript. Not sure how that would be implemented though.

Let's see how that would be done.

It turns out that normal objects get copied, but class instantiated objects are not being copied. Instead they are still by reference. So we must be careful to make sure that the objects being inserted into our datascript are class instantiated objects, the only difference where the constructor is different from Object, that's all! In fact you can even mutate them afterwards. Still I think it should be made explicit.

It is how ever recommended to instead use object with explicit object ids being inserted into datascript. This is the example:

```
db = d.empty_db({"obj-id", {":db/index" true}});
db1 = d.db_with(db, [[':db/add', 1, 'obj', obj1], [":db/add", 1 "obj-id" obj1.id]
                     [':db/add', 2, 'obj', obj2], [":db/add", 2, "obj-id", obj2.id]

;; Now query by obj id:
d.q('[:find (pull ?e [*]) :in $ ?obj :where [?e "obj-id" ?obj]]', db1, obj1.id);
```

So now you need a factory method that gives me the object id instead. This could use the js-resource-counter, where each object allocates a number that it knows about, and only on deletion is the id deallocated which allows the factory to reuse that id. So yes this could work.

Also the id itself now needs to be attached to an indexed datascript attribute. Like `object/pointers-id`. But not sure how to add the pointers itself.

So maybe the point of having pointer ids is intended for indexing, as indexing in a btree relies on order or something. Ok I can accept that. Too bad no hash based indexing. As for the actual ids themselves, we can maintain a weak map, and js-resource-counter that will handle these ids that are inserted and deallocated when not needed. Note that when they are really deleted they need to have their id deallocated. What about the db ids themselves?

```
var d = require('datascript');

const db = d.init_db(
  [
    [1, 'obj', 2],
    [2, 'obj', 2]
  ]
);

d.pull(db, '[*]', 1);

// another way is this, where you can state the same fact twice
// but the schema says that the cardinality of the thing is many
// so the end result is that obj gets appended directly
const db = d.init_db(
  [
    [1, 'obj', 2],
    [1, 'obj', 2]
  ],
  {'obj': {':db/cardinality': ':db.cardinality/many'}}
);


const db = d.empty_db();
const db1 = d.db_with(
  db,
  [
    [':db/add', 1, 'obj', 2],
    [':db/add', 2, 'obj', 2]
  ]
)

```

Ok so we can `init_db`, but the way it is done is not the same as using `db_with`, where this one takes an array of vectors, representing facts. Additional facts that is. Whereas `init_db` takes some sort of datoms list. Not sure how it's meant to be used however. Note that `init_db` would only be useful for bulk loading. Ok so I now I know. Also you can init db with things like `e: ..., a: ..., v: ...`, so not just vectors but also records.

That's really interesting!


```
const d = require('datascript');

const map = new WeakMap;

class DummyObj {}
let obj1 = new DummyObj;
let obj2 = new DummyObj;

map.set(obj1, 1);
map.set(obj2 ,2);

const db = d.empty_db();

let db1 = d.db_with(db, [[':db/add', 1, 'obj', obj1], [':db/add', 2, 'obj', obj2]]);
let db2 = d.db_with(db1, [[':db/add', 1, 'obj', 2]]);

db1 = undefined;
obj1 = undefined;

// then obj1 should be gone right
// damn how do we test this!?
// chrome devtools show that this is true!!!
// woo
// now all i have to do is make sure my counter is immutable
```

The above shows you that you cannot index the objects. Ok... it returns with an error about not being able to compare 2 objects.

We need to test that when we overwrite the object for datascript if that object still exists in memory. We can use a weakmap to as if it still exists however. Good way to test datascript.


```
const d = require('datascript');

class DummyObj {}
let obj1 = new DummyObj;
let obj2 = new DummyObj;

const db = d.empty_db();
let db1 = d.db_with(db, [[':db/add', 1, 'obj', obj1], [':db/add', 2, 'obj', obj2]]);
let db2 = d.db_with(db1, [[':db/add', 1, 'obj', obj1]]);
```

The above shows that db1 and db2 are not the same databases.

---

We now have a fully persistent counter.

We are going to combine this with data script to create a fully persistent NodeTable.

The counter is needed as we need to deal with ids generated for each openlink and closelink, since these objects have no order and weren't able to be indexed by datascript.

Using these things, we can insert and instead index on these extra properties.

That allows one to query the table by a particular link open or closed.

However this means we need to maintain a weakmap of open links and close links to their ids that are generated for them.

Note that when they are deleted, we must then explicitly remove their ids and deallocate from the counter.

When this happens, this is an immutable modification on the datascript. Correspondingly it's an immutable modification on counter as well. This means we maintain the counter for creation of new things.. too.

Also shouldn't be exporting our types? Not really..

Also our weakmap that is adding new stuff. Don't we need an immutable thing that associated objects to the counter id as well?

As a modification means generating a unique id from the counter, and then passing that into the map between objects (unordered stuff)...

So we need an immutable map now to act as our tagging system.

I know where to find this pretty easily. We can use immutable.js, immer, red black tree... etc.

Or we just use another datacript database. This one associates... Wait that's dumb, we cannot index by objects anyway. That's the reason why we are using datascript. So it has to be something where we can query by object.

Wait we need a weakmap though! Cause we don't have to keep track on the objects twice. Damn not possible to create an immutable weakmap.

So it just means we have to explicitly delete it from the immutable map as well.

```
const d = require('datascript');

const db = d.empty_db();

db1 = d.db_with(db, [
  [':db/add', -1, 'key', 1],
  [':db/add', -1, 'key', 2],
  [':db/add', -1, 'key', 3],
]);

db2 = d.db_with(db1, [
  [':db/add', -1, 'key', 4],
  [':db/add', -2, 'key', 5],
  [':db/add', -3, 'key', 6],
]);

// each negative number is given a different id
// but how to find the id?

d.pull(db2, '[*]', 1);
d.pull(db2, '[*]', 2);
d.pull(db2, '[*]', 3);
d.pull(db2, '[*]', 4);
```

// oh the -1 doesn't appear to make sure we have the right entity
// and transaction appears to require a connection


// once you have an entity, you can lazily get the actual value by doing `e.get('prop')`

```
let e = d.entity(db, 1); // entity implements ES6 map interface
e.get(':db/id');
e.get('key');
```

Transactions seem to allow us to get the id, but why not normal functions?

Use resolve tempid to setup correspondence to the real key.

```
const d = require('datascript');

conn = d.create_conn();

// -1 refers to the same id here
// so -2 might refer to multiple

tx_report = d.transact(conn, [
  [":db/add", -1, "name", "Ivan"],
  [":db/add", -1, "age", 17]
  [":db/add", -2, "name", "SOMEBODY"]
]);

tx_report = d.transact(conn, [
  { ':db/id': -1, name: 'Ivan' },
  { ':db/id': -2, name: 'Blah'}
]);

d.resolve_tempid(tx_report.tempids, -1);
d.resolve_tempid(tx_report.tempids, -2);

// oh shit it works
// actually it's really easy, resolve_tempid just fetches our object details lol
```

This doesn't give us all teh ids that are being used for some reason..
So I don't think `:db/add` makes sense. We can also use `:db/id`. Instead, so would that work instead?


So we shall use the transact, but with a connection created from the db. How do we later close the connection?

To get the db from a conn, use `d.db(conn)`. Then you get back the db! Ok so we just get a conn from the db, and then use that to perform the transaction, and then convert it back to the db so we can have it at the state after all transactions are performed.

Example for retraction:

```
const d = require('datascript');

const db = d.empty_db();

db1 = d.db_with(db, [
  [':db/add', -1, 'key', 1],
  [':db/add', -1, 'key', 2],
  [':db/add', -1, 'key', 3],
]);

db2 = d.db_with(db1, [
  [':db.fn/retractEntity', 1]
]);

// retraction has to retract every specific attribute
// damn... and you NEED the value too

// each negative number is given a different id
// but how to find the id?

d.pull(db2, '[*]', 1);
d.pull(db2, '[*]', 2);
d.pull(db2, '[*]', 3);
d.pull(db2, '[*]', 4);

// find where id is equal to something
// will tell you if the id was retracted or not unlike entity
d.q('[:find ?e :in $ ?e :where [?e]]', db2, 1);

d.q(
  '[:find (pull ?e [*]) :in $ [?key ?value] :where [?e ?key ?value]]',
  db1,
  ['key', 1]
);
```
