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
  [':db/add', -2, 'key', 3],
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
  ['key', 3]
);


d.q(
  '[:find (pull ?e [*]) :in $ [?key ?value] :where [?e ?key ?value]]',
  db1,
  ['key', 4]
);
```


Make sure to keep track of the parent pointers when you do the path copying.
An iterator is only consistent as it maintains the current tree as its iterating.
Any modification that occurs against the iterator would need give you back a new tree.

Alternatively, one starts a transaction, from that transaction, they start an iterator.
That iterator then allows one to do operations against the current tree.

```
  oi = oi.transaction((ot) => {
    op1(ot);
    op2(ot);
  });
```

Usually the idea of a transaction, is that you don't get back a new tree. So within that transaction, everything is mutable. So how does this work exactly? Since each operation can conflict with another.

If `op1` and `op2` don't conflict with each other, it's totally fine. But if they do, then you have a problem.

What this means starting a transaction, means you get a mutable tree for that time being. So as your iterating, you're iterating with a mutable tree. So as you mutating the tree, you will encounter things you are iterating to. So this has a bad semantics, but you have to be careful with your iteration.

Alternatively, if you start an iteration, and then you start a transaction.

```
oi = oi.transaction((ot) => {
  i = ot.getIterator();
  i = i.next();
  i.insertSibling(node);
  i = i.next(); // this is the node that you just inserted
});
```

Well the idea.. is that how does this work exactly

```
i = oi.getIterator(p);
i = i.next();
oi2 = i.insertSibling(node);
i = i.next(); // this is not node
```

Each operation then gives you a new tree.

So if you have interleaved iterators:

```
i1 = oi.getIterator(p);
i2 = oi.getIterator(p);

i1.next();
oi2 = i1.insertSibling(node); // because this doesn't return the iterator itself, are we saying this should be returning the iterator instead

i1_ = i1.insertSibling(node); // this way you can weave in the iterator each time, you're iterating on the new modified tree

// you can always get three for the given iterator again, as each iterator represents a snapshot onto the tree (a sort of capture)

oi3 = i1_.getTree();



i2.next();
oi3 = i2.insertSibling(node);

// oi2 !== oi3
```

So this all works nicely!

Now how do you do this:

```
oi = oi.transaction((ot) => {
  ot.insertAt(p, node);
  ot.insertAt(p2, node);
  // the above don't conflict with each other
  // so it's all good
  ot.deleteAt(p);
  ot.insertAt(p, node);
  // this conflicts with the top, and should fail
  // because the p no longer exists
  // what is p exactly? it is the actual pointer referring to a node (along with some other direction notation)
});
```

Remember insertion operations, means navigating to a position and inserting!

After all, one should compare against DeltaNI.

For concurrency control, that is interleaved iterators that should merge their changes accordingly, how does one do this? Well the main idea is that, we need to represent the 2 iterations as 2 transactions (because each maintain a snapshot of the data). Then when they finish iterations, that means their transaction is committed. Then they essentially need to be merged.

```

oi = oi.transaction((ot) => {

  i = ot.getIterator(p);

});

oi = oi.transaction((ot) => {


});

i1 = oi.getIterator(p);
i2 = oi.getIterator(p);

i1.next();
oi2 = i1.insertSibling(node);

i2.next();
oi3 = i2.insertSibling(node);
```

Ok so if we imagine that iterators actually return themselves (along with any data) they are meant to return. Then we can just use that. Ok this makes more sense now..

```
// if normally iterator manipulation (what do we mean by p?)
// p is some combination of iterator + direction
// cause the iterator is a cursor into the tree
// so it always points to something exactly
// but wait we have 2 notions of cursor
// a cursor that "points" to a node
// a cursor that "points" to an entry (the positive/negative parts of a node)
// we can combine both notions, such that a cursor always points to a node + opening/closing entry
// when it's pointing at any one entry, we update both, such that we can go to a node opening or closing at any point
// so any pointer to a row in the table can be considered a cursor, but it's more overloaded than that, we have both a pointer to the tree, and a pointer to the table (both are immutable) (but with the table, we don't have an exact pointer to a row, we instead have the relevant node), that being said the relevant node maybe filled (queried) from the database, since we know the database is immutable, we can be sure that it doesn't change from underneath us, so we can be sure that this is the node that we care about



oi = oi.transaction((ot) => {

  // since we are in a transaction, we expect cursors to not return new cursors, but instead just mutate the current tree
  c = ot.getCursor(p);
  c.insertSibling(node);
  // but is c still stable now?
  // what does this do?
  c.next();
  // is it pointing at node, or the old node?
  // but gut feeling is that it's pointing at the new node
  // that was inserted, here you need to be careful now!

});



c = ot1.getCursor(p);
c = c.insertSibling(node);
c = c.next() // this doesn't involve a copy, since no modification occurred (but matches the API)
c2 = c.clone() // this would actually clone the cursor into a different one
c = c.insertSibling(node);
ot2 = c.getTree()
// ot1 and ot2 is not the same tree anymore
// but this is not very efficient

// interleaved cursors are no longer a problem since each cursor is maintaining their own thing, and they really are diverging
// can you have 2 cursors on the same tree... sure, but unless you modify, then you need to merge or figure out using a BIGLOCK representation
// at that point you need a transaction manager that can merge 2 updates
// PESSISMISTIC OR OPTIMISTIC (we can use CAS operations) and retry kind of thing

// with the counter, the only CAS operation would occur on conflicting numbers
// [,c2] = c.allocate()
// [,c3] = c.allocate()
// c.transaction((ct) => {
//  ct.allocate();
//  ct.deallocate();
// })
// conn = startConn()
// async1(conn)
// async2(conn)
// now conn may run asynchronously
// async1:
//   conn.transaction(ct => {
//     setTimeout(() => { ct.allocate(); });
//   })
// wait it's not possible to have conflicts in this way, each transaction runs exactly
// what happens then? well the transaction finished, but you still have ct somewhere
// then that means it's still closure that contains the original counter
// but the callback already finished, and packaged up a new CounterImmutable
// what happens is that, the old tree is still referenced by ct, but ct now has nothing to do with the new tree, so if that allocates against the tree, it's still using the old snapshot

// it still refers to tree in the closure, but nothing can access that tree
// it still gets new trees when allocating
// it still has that snapshot
// the tree that was returned, is now not the tree that ct is working against
// so it's pointless, you can't do anything with it


```


Should `c.next()` copy and give you a new cursor completely independent? I feel like returning back c is not very intuitive. It should be instead, if I'm really moving a cursor, then it should just be `c.next()`, not returning anything. If one wants to clone, then it should be explicit with `c.clone()`. And all that is really doing is passing the tree into a new counter, such that the new counter has to deal with the new tree that gets mutated and table as well.

In the context of transactions, it's only possible for there to be a concurrent merge in asynchronous operations in JS. Normally using modification returns new cursors, this works even with interleaved cursors so they never conflict, they are always diverging. Using modification while in transaction is just mutable and you have to deal with errors as you go (this is the high performance problem, but you maybe you shouldn't be iterating in a transaction). You cannot get interleaved transactions in JS due to run-to-completion semantics for the transactions, each is atomic operation anyway. An iterator inside a transaction should just respect the mutability of everything, so you don't get stable iteration there. But if you wrap the index tree within a "transaction manager", then you pass these 2 into separate async operations. Then there should some sort of concurrent merging behaviour, where 2 semantically separate operations should be able to merged together, but if not, one should fail, and have to retry with new assumptions. This merging process is complicated, and requires that the underlying data structure supports a sort of Optimistic Control, either with CAS based operations. The problem, is that we have to enumerate the kind of conflicts that can occur, and these can occur within the rebalancing operations, 2 operations may rebalance the tree in different ways, we don't want to have to merge conflicting differently balanced stuff, but instead merging at the semantic level, 2 nodes inserted at different areas should not conflict with each other.

Consider this concept:

```
   A
  / \
 B   C
```

You have 2 asynchronous operations that work against the same "connection" to a global tree.

Op1 wants to do this, an inner node relocation:

```
   A
    \
     B
      \
       C
```

Op2 wants to do this, add a new leaf under B at position 0.

```
     A
    / \
   B   C
  /
 D
```

What's the merging of the two?

```
   A
    \
     B
    / \
   D   C
```

OR:

```
   A
  / \
 D   B
      \
       C
```

Or is this just a conflict?

We would need to define the formal semantics of this system. To make this work. If we are inserting a leaf at position 0, that's saying we want D to be the first child of B. If we are doing a inner node relocation, we are saying we want B to be the parent of C. These 2 statements are not strictly conflicting with each other, but leaves us with some ambiguity. There are 2 ways to resolve this, just choose any one of them (deterministically speaking) because maybe it doesn't matter (in fact this can depend actually on which transaction occurred first or perhaps which transaction committed first). Or fail one of the transactions, and ask them to repeat the order with new assumptions. If the order is repeated by saying I want D to be the 0th child of B, then it now it is just done, and we get the first merged tree.

How does this exactly get merged? Well we would need some sort of locking system on each node. When transaction 1 starts inner node movement, it needs to tell everybody else and atomically lock node B. This particular lock has special semantics, as it would tell the connection manager to then receive transaction 2 to add a new leaf to child position 0. Then this would just attempt to synchronise the 2 operations. As they are kind of independent. If transaction 2 REALLY wanted to make sure that D is infact the first child of B, it would need to acquire a lock on B, if that B is being moved then it has to block and wait on it. And then it just inserts D as ahead of C. Alternatively we can use optimistic concurrency control, where transaciton 2 REALLY wants to make sure D is the first child, then what would need to happen is that it would try to do it, but it would fail to do so...

So the connection manager has to make decisions on which transactions started first, which modification started first, and which transaction committed first, which then tells us whether we are doing pessimistic concurrency control (the transaction is blocked) or optimistic concurrency control (the transaction fails) or if they are merged with no problems. There would need to be more formal semantics over what those operations really are.


I would need to read more about MVCC in other situations before figuring this out fully. Also fat node techniques as well.

Anyway to make this immutable, we need to combine it with rebalancing. Such as that as we are rebalancing (simplifying the tree), we also take care to copy whatever that needs to be copied.


```
// package reference-obj

class Reference<T> {

  _value: T;

  contructor (value: T) {
    this._value = value;
  }

  static from (value: T) {
    return new Reference(value);
  }

  get (): T {
    return value;
  }

  set (value: T): void {
    this._value = value;
  }

}

x = Reference.from(true);

x = Ref(true); // also we can do this

x = Ref.from(true); // this is smaller too

x = new Ref(true); // this is smaller too

// also we can have a short name P
// import { Reference as P } ...

// new P(true)
// P.from(true);

x.set(false);
x.set(true);
x.set('abc'); // bad!

x(value); // sets the value
x // what is x?

// we should overload it depending on what the x is
// so it acts like x
// in fact even proxy everything to it as well in a way
```

---

We need to make sure that if 2 keys have the same objects and they need to be tagged, then they are given the same tag. And we just use 1 tag for each.

But wait, if one key gets changed for another, now we need 2 different tags, we have to keep track of the tags.

Damn how do we make sure we can encapsulate the notion of tagging objects?

[Object, tagger] = tagger.tag(Object)

The result is the object you get is tagged. The tagger is a new tagger (as it is immutable). The tagger needs to maintain knowledge of the `indexTags`, so we know if we have things that are the same object. So if multiple objects are the same. Cause the tagMap will map objects to tags. And those objects may be the same when we ask for them.

So the idea is this:

If we are to ask SEARCH for WHERE key = object.

The tagger will take the key, give us the key-tag. And then give us the unique number.

Given key, object, it gives back `key-tag`, id.

So the same object must give back the same id.

But when we delete or remove objects, we are saying that here is key, object. And we may need to remove certain pairs. That is key1, key2 may refer to Object1, but removing a pair.

So when we tag a an

---

The only way to make the tree immutable is not to use path copying, but the fat node strategy.

Research on the fat-node strategy, dealing with multiple parent pointers, and maybe deltani, and other ways of managing this with MVCC and B+trees.

Possibly trying to hook into the GC system to remove old pointers. But also JS doesn't allow this.

https://stackoverflow.com/questions/29333017/ecmascript-6-class-destructor
https://developer.mozilla.org/en-US/docs/Web/JavaScript/Memory_Management

See Observable too.

https://www.cs.cmu.edu/~sleator/papers/making-data-structures-persistent.pdf

Page 97:

With the fat node approach, we can make an ephemeral linked structure fully persisten at the worst case space cost of O(1) per update step, and an O(log m) worse case time cost per access or update step. With a variant of node copying called node splitting, we can make an ephemeral linked structure of constant bounded in-degree fully persisten at O(1) amortized time and space cost per update step and an O(1) worst case time cost per access step.

This partial ordering is defined by a rooted version tree. Whose nodes are the versions (0 through m), with version i the parent of version j if version j is optained by updating version i. So there is a linear ordering of versions. Version 0 is the root of the version tree. The sequence of updates giving rise to version i corresponds to the path in the version tree from the root to i.

When a new version i is created, we insert i into the version list immediately after its parent (in the version tree).

The resulting list defines a preorder on the version tree.

The direction towards the front of the version list is leftward. The direction towards the back of the list is rightward.

We need to also be able to determine if 2 versions i, j. That i precedes or follows j in the version list. This list order problem has been addressed with a list representation supporting order queries in O(1) worst case time. With O(1) amortized time bound for insertion. There's also a more complicated one with both query and insertion time being O(1). This is a Dietz and Sleator[11].

Having dealt with the navigation issue. We can investigate how to use fat nodes to make a linked structure fully persistent.

The fat nodes are where each node holds an arbitrary number of values PER field. Each extra field has an associated field name and version stamp. The version stamp indicates the version in which teh named field was changed to have the specified value. In addition, each fat node has its own version stamp. So fields have version stamps, and nodes have version stamps.

Consider update operation i, when an ephemeral update step creates a new node, we create a corresponding new fat node, with version stamp i. Containing the appropriate original values of the information and pointer fields. Right this means that his new node that is inserted has a version stamp that is different from all the other nodes (as it is a new node).

When an ephemeral update step changes a field value in a node, we add the corresponding new value to the corresponding fat node. Along with the name of the field being changed and version stamp of i. For each field in a node, we store only 1 value per version. When storing a field value, if there is already a value of the same field with the same version stamp, we overwrite the old value. Original field values are regarded as having the version stamp of the node that contains them (right so they have a default version stamp).

If it is not allowed that the structure can change the same field to the same value within the same transaction, there's no need to test if the value is the same with the same version stamp.

We navigate through the persistent structure as follows. When an ephemeral access step is applied to version i accesses field f of a node. So access operations are given a particular version tag to use. We access the value in the corresponding fat node whose field name is f, choosing among several such values with the maximum version stamp NO GREATER than i. So if access operation with version i is being used, we return the value that corresponds to version i preferably or a version before it. But never return a version greater than i. If none fits, then there is no value for this access operation!

We also need an auxiliary data structure to store the access pointers of the various versions.

This structure consists of an array of pointers for each access pointer name. After an update operation i, we store the current values of the access pointers in the ith positions of these access arrays. With this structure, initiating access into any version takes O(1) time. This is just saying that there's a way to always access each version in O(1) by creating an array of versions. Is this talking about each node pointer that points to other nodes? Not sure...

It suffices to regard each original field value in a node as having a version stamp of 0.

The example on page 92, we have a fat node approach for partial persistence for a binary search tree. This tree performs tree rotation as well for balancing. The point is, each arrow is attached with a version number. We begin version number at 1, since the tree by default would be empty (and that would be version 0). So each insertion operation is given a version stamp. We have operations:

```
Insertions
E - 1
C - 2
M - 3
O - 4
A - 5
I - 6
G - 7
K - 8
J - 9

Deleteions
M - 10
E - 11
A - 12
```

This shows then the tree with new pointers with new numbers. For example at the deletion of M, that's the 10th operation. Here we delete M, rotate K to the the position of M, which means J needs to be the right child of I. We can see a bunch of pointers with version stamp 10. It's like we are overlaying pointers basically. The fat node of E, is now pointing to both M with version stamp 3, but also K with version stamp 10. The problem with this, is that there's no explicit garbage collection of the old version. Nothing here means you can lose access to all the pointers, unless those pointers were not stored in the nodes themselves, but instead elsewhere. Like a sort of array of version pointers, where when you are at E, you can ask for E's pointers at version I. And if they exist, they will be there. Suppose asking that is like asking whether I exist or not. Not sure if a weakmap could support this. Like maybe a multikeyed weakmap. So if something loses reference to the version 1, it should no longer exist. Problem is, version 1 is still useful for all the versions, since nothing removes E until the 11th operation, so if somehow you lose reference to version 1 - 10, then only then should E be garbage collected.

The paper says that choosing which pointer in a fat node to follow when simulating an access step takes more than constant time. If the values of a field within a fat node are ordered by version stamp and stored in a binary search tree, simulating an ephemeral access or update step takes O(log m) time.

This means that there is a logarithmic factor blow up in the times of access and update operations over their times in ephemeral structure.

The path copying strategy described in the paper is quite different from the basic form of path copying, they appear to sometimes not actually copy the root depending on some situation. I think it's because they only cared about partial persistence in this case. Now back to page 98, we are finally back at full persistence. And here we have a version tree.

It really shows the tree as before in a way. But instead it shows the operations that is applied, according to the pointers that is being used.

We have version 0, with an empty node.

Each node represents an update operation `i` or `d`. The nodes are labelled with the indices of the corresponding operations.

This tree is of operations is not the same sort of operations as we examined. It's different.

Seems like if you were to enforce a total order on this tree, it corresponds to inserting E, A, G, K, deleting E, inserting C, A, M, then inserting M, I, deleting M, inserting O. I don't understand this to be honest.

So apparently with the fat node approach, navigating the versions now requires accessing the "version list". Rather than with respect to their numeric values. That is to find the value corresponding to field f in version i of ephemeral node x, we find the fat node x^ corresponding to x the value of field f whose version stamp is rightmost in the version list but not to the right of i.

So wait.. we have a version list, and we need to consult it to get the right fat node.

Updating differs slightly, insertion of new versions in the middle of a version list makes it in general necessary to store 2 updated field values per update step rather than 1. We begin update operation i by adding i to the version list as described above.

This version list is actually a version tree, but with the ability to have a total order.

When an ephemeral update step creates a new ephemeral node, we create a corresponding new fat node with version stamp i, filling in its original fields appropriately. Suppose an ephemeral update step changes field f of ephemeral node x.

Let i+ denote the version after i in the version list. If such a version exists. To simulate the update step, we locate in the fat node x^ corresponding to x values v1 and v2 of field f such that v1 has the rightmost version stamp not right of i and v2 has leftmost version stamp right of i. (supremum and infimum?). Let i1 and i2 be the version stamps of v1 and v2.

Remember that v1 and v2 are the values of the 2 versions (i1, i2) of the field f.

If i1 = i, we replace v1 by the new appropriate new value of field f. If in addition i is the version stamp of node x^, v1 is a null pointer and i+ exists, we store in x^ a null pointer with field name f and version stamp i+, unless x^ already contains such a null pointer. So this is saying that if our operation version stamp is the same as i1, then all we do is update the value mutably, and then possibly create a null pointer that points to the field name f with version stamp i+ (the version after i in the version list if it exists).

If i1 < i, we add the appropriate value of field f to node x^ with a field name of f and a version stamp of i. If in addition i1 < i and i+ < i2 (or i+ exists but i2 does not exist), we add x^ a new copy of v1 with field name f and a version stamp of i+. This guarantees that the new value of field f will be used only in version i and value v1 will still be used in versions i+ up to but not including i2 in the version list.

This seems to imply that there are multiple versions in the version list, you can update any one of them, but that itself may not actually generate new versions (or if it does), why doesn't it diverge?

At the end of the update operations we store the current values of the access pointers in the ith positions of the access arrays. The current values of the access pointers are those of the parent of i in the version tree as modified during the update operation.

Let v be a value of a field f having version stamp i.

This paper is not examining immutable structures. This is examining fully persistent ones where you can have multiple versions of the structure, and each version can be mutable changed. And as you change you still seem to be able to optionally make new versions. Basically upon doing an update, you can choose whether to update and create a new version, or update an existing version (and these updates occur mutably). This is slightly different situation from what I want, since in the case of immutable structure, each update is meant to create a new version (except in the limited case of a transaction).

The actual inverse pointers is used for maintaining node splitting which was an improvement on top of fat node strategy used for their fully persistent binary search tree.

On the wikipedia system, it says that given that purely functional computation is always built out of existing values, it would seem that it is impossible to create a cycle of references. This seems to mean that we wouldn't be able to create a purely functional data structure with cyclic references. And that such data structures would have to be a directed acyclic graph. But this can be avoided, since functions can also be defined recursively, this allows to create cyclic structures by using functional suspensions. Is it possible for us to discard parent pointers and instead use functional suspensions to go up to the parent?

https://stackoverflow.com/questions/18007606/pure-functional-tree-with-parent-pointer

The solution is to add indirection. You assign identities to the values. You then use them as lookup keys, you can think of an immutable pointer as an implementation of IDref, which always returns the same object. A cyclic graph can be represented as an adjacency graph, then you can deref the node by name is the same as looking it up in a map of names to nodes.

---

Ok so now we can use parent point table to relate a node to their parent node, and since after modification, there's a new parent id pointing to the new parent, this works. So now you get an immutable BOTree even with parent pointers. However our parent pointer table needs to be indexed by the parent id now. So now we have a unique id for each object too.

Still each iterator when performing the operation needs to give you the new iterator with the new changes, the old iterator still works on the same thing.

To prevent diverging trees, you need to wrap all your operations within a transaction.

Alternatively, each operation is worked against a transaction manager that instead merges each operation back into a global tree, and this is done via locks and optimistic concurrency control.

Just need to get tagger tested, and then integrated.

Then we just abstract out the parent pointers.

---

Note for concurrency control, there's some talk about it here too with regards to cursor for immutablejs:

https://github.com/redbadger/immutable-cursor

https://github.com/lukasbuenger/immutable-treeutils

---

Abstracting parent pointers

Ok so apparently an issue is that datomic doesn't really have a "transactional" with mutations concept, instead every transaction is a unit request. But so really I'm just creating a new DB anyway. And I can't even pull stuff out using the conn, without first getting the DB from the conn. And the report iteslf tells tells us what it did inside it's tx_data. It also tells us before and after. So within the deleteNode function, I should be able to instead just use check the tx data for anything, and then if so, strip that and return it.

But for other things you'll need to pull out the db from the conn and then use it. The conn itself keeps track of previous db and new db anyway though.

Does it work like pull though? Does it really give us the necessary objects. I will check with a full test.
