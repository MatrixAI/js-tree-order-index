// @flow


// an order index supplies these primitive operations
// but the BOTree does far more with regards to insertion right
// so you insert according to a backlink remember
// that's how findEntry works
// but the same must be applied according to the backlink structure
// note that backlinks are not pointers, no for the BOTree
// the AOTree backlinks are just normal pointers in that case though
// so an insertion uses that...

// what is OrderLink and what is OrderEntry
type orderEntry = Object;

interface OrderIndexInterface<L: OrderLink> {
  getNodeId (entry: orderEntry): number;
  findEntry (orderLink: L): entry;
  isLower (entry: orderEntry): boolean;
  isBefore (entry1: orderEntry, entry2: orderEntry): boolean;
  nextEntry (entry: orderEntry): orderEntry;
  adjustLevel (entry: orderEntry);
}

export type { OrderIndexInterface };
