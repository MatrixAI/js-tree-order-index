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
