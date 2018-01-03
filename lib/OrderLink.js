//@flow

import type { OrderEntry } from './OrderEntry.js';

// the OrderLink needs to keep track of something in the OrderIndex
// what is this something
// it's a pointer
// but the type to the pointer is different depending on what the underlying order index is
// in BOTree, it's a Leaf node

interface OrderLinkI {
  block: Leaf,
  getEntry (): OrderEntry;
};

export type { OrderLinkI };
