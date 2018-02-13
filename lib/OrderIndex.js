// @flow

import type { NodeTableI } from './NodeTable.js';

type OrderEntry = {
  id: number;
  status: boolean;
};

interface OrderIndexI<linkOpen, linkClose, data, cursor> {

  // now we can get things that are either links
  // the linkOpen and linkClose just point to 2 different things
  // either a cursor to the opening entry or the closing entry
  // then getLink could give you linkOpen or linkClose depending on what the cursor is pointing to an opening or closing

  getNodeTable (): NodeTableI<linkOpen, linkClose, data>;
  findCursor (linkOpen|linkClose): ?cursor;
  getLink (cursor): linkOpen|linkClose;
  getEntry (cursor): OrderEntry;
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
  insertEntryPairRoot ([OrderEntry, OrderEntry]): [cursor, cursor];


  insertEntryPairChild (
    [OrderEntry, OrderEntry],
    ?[cursor, cursor, number]
  ): [cursor, cursor];

  insertEntryPairSibling ([OrderEntry, OrderEntry], cursor): [cursor, cursor];
  isBeforeCursor (cursor, cursor): boolean;
  adjustLevel (cursor): any;
}

export type { OrderEntry, OrderIndexI };
