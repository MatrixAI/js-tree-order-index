
import type { NodeTableI } from './NodeTable.js';

type OrderEntry = {
  id: number;
  status: boolean;
};

interface OrderIndexI<data, link, cursor> {
  getNodeTable (): NodeTableI<data, link>;
  findCursor (link): ?cursor;
  getLink (cursor): link;
  getEntry (cursor): OrderEntry;
  getCursorOpen (cursor): ?cursor;
  getCursorClose (cursor): ?cursor;
  nextCursor (cursor): ?cursor;
  prevCursor (cursor): ?cursor;
  nextCursorOpen (cursor): ?cursor;
  prevCursorOpen (cursor): ?cursor;
  nextCursorClose (cursor): ?cursor;
  prevCursorClose (cursor): ?cursor;
  nextSiblingCursors (cursor): ?[cursor, cursor];
  prevSiblingCursors (cursor): ?[cursor, cursor];
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
