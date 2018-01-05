//@flow

import type { OrderEntry } from './OrderEntry.js';

// the OrderLink needs to keep track of something in the OrderIndex
// what is this something
// it's a pointer
// but the type to the pointer is different depending on what the underlying order index is
// in BOTree, it's a Leaf node


// OrderLinkI doesn't know what the entry actually is
// it depends on the agreement between Order Index tree and the NodeTable
// it is thus generic
// since it just mediates this
// we know that backlinks point to an order entry
// but the way it does this can be different
// if gapkeys, then it is both a pointer to the leaf block and a gap key
// the actual order entry is just { id, status }
// if it is actually a pointer and offset, then same idea
// in the case of an AOTree, the backlink is actually just a pointer to the AVL tree node/leaf
// the order entry is then the same thing
// so really what we need is some generic representation of a pointer
// a POINTER can be { Leaf + GapKey } or { Leaf + index } or { AVLNode | AVLLeaf }

interface OrderLinkI<entry> {
  entry: entry
};

export type { OrderLinkI };
