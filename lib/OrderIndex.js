// @flow

import type { NodeTableI } from './NodeTable.js';

type OrderEntryTotal = {
  id: number,
  status: boolean
};

type OrderEntryPartial = {
  id: null,
  status: boolean
};

type OrderEntry = OrderEntryTotal | OrderEntryPartial;

interface OrderIndexI<linkOpen, linkClose, cursor> {

  // we need also the first cursor and last cursor
  // whatever implements the order index should be able to tell us this
  // but remember cursors don't keep reference to node
  // they keey the id, and the id gives us the node in the node table
  // so this means we go from the root downwards on the left hand side
  // and make a cursor out of that

  firstCursor (): ?cursor;
  lastCursor (): ?cursor;

  // this goes from Node to cursor via links
  findCursor (linkOpen|linkClose): ?cursor;

  getLink (cursor): linkOpen|linkClose;

  getEntry (cursor): OrderEntryTotal;

  getCursorOpen (cursor): cursor; // get the corresponding open cursor (could be itself)
  getCursorClose (cursor): cursor; // get the corresponding close cursor (could be itself)
  nextCursor (cursor): ?cursor; // get next cursor (open/close) in document order
  prevCursor (cursor): ?cursor; // get prev cursor (open/close) in document order
  nextCursorOpen (cursor): ?cursor; // get the next cursor that is open (could be a nested node) or the sibling node (useful for straight iteration)
  prevCursorOpen (cursor): ?cursor; // get the prev cursor that is open (could be nested in the previous sibling node)
  nextCursorClose (cursor): ?cursor; // get the next cursor that is closed
  prevCursorClose (cursor): ?cursor; // get the prev cursor that is closed

  nextSiblingCursors (cursor): ?[cursor, cursor]; // get the next sibling cursors (this gives you both cursors, because the jump required will give you both opening and closing anyway)
  prevSiblingCursors (cursor): ?[cursor, cursor]; // get the prev sibling cursors (this gives you both because the jump requried will give you both opening and closing anyway)

  // insert a new entry pair (node) as the root
  // we get back a pair of cursors to them
  // do we need this?


  // insert new root, gives back a continuation for it continue doing it
  // that continuation gives back 2 cursors

  // what if links and cursors were slightly separate
  // in that a link represents a target to something
  // but a link cannot be a cursor until the thing it points to is a legitimate pointer
  // and that means the id is filled
  // the callback doesn't really need to return a cursor


  // what does the callback return in that case
  // we already have the links returned
  // that can be installed into the node table
  // shall the callback return the orderEntries?
  // or what?
  // the cursors?

  // insertChild instead takes linkOpen, linkClose of the parent node
  // and a position number to mean insert 0 (leftmost)
  // -1 rightmost
  // and all other positions are bounded!

  // all this means is that links can point to unrealised entries
  // whereas cursors only point to realised entries

  insertRoot (): [
    [
      linkOpen,
      linkClose,
      NodeLevel,
      (NodeId) => void
    ],
    OrderIndexI<linkOpen, linkClose, cursor>
  ];

  insertChild (
    linkOpen,
    linkClose,
    number
  ): [
    linkOpen,
    linkClose,
    NodeLevel,
    (NodeId) => void
  ];

  // insert after?
  // insert before?
  // cause if we insert after or before, we don't care about one or the other
  // and what if we want to insert multiple siblings ahead?

  insertSiblingBefore (
    linkOpen,
    number
  ): [
    linkOpen,
    linkClose,
    (number) => void
  ];

  insertSiblingAfter (
    linkClose,
    number
  ): [
    linkOpen,
    linkClose,
    (number) => void
  ];





  /* insertEntryPairChild (
   *   [OrderEntry, OrderEntry],
   *   ?[cursor, cursor, number]
   * ): [cursor, cursor];*/

  insertEntryPairSibling ([OrderEntry, OrderEntry], cursor): [cursor, cursor];

  isBeforeCursor (cursor, cursor): boolean;
  adjustLevel (cursor): any;
}

export type { OrderEntry, OrderEntryTotal, OrderEntryPartial, OrderIndexI };
