// @flow

type OrderEntry = {
  id: number;
  status: boolean;
};

interface OrderIndexI<link, cursor> {
  findCursor (link): ?cursor;
  getEntry (cursor): ?OrderEntry;
  getLink (cursor): ?link;
  nextCursor (cursor): ?cursor;
  nextCursorOpen (cursor): ?cursor;
  nextCursorClose (cursor): ?cursor;
  isBefore (cursor, cursor): boolean;
  adjustLevel (cursor): any;
  insertEntryPair (
    [OrderEntry, OrderEntry],
    ?[link, link, number]
  ): [link, link];
}

export type { OrderIndexI, OrderEntry };
