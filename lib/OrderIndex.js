// @flow

type OrderEntry = {
  id: number; // this gives you the nid
  status: boolean; // this gives you whether its opening or closing
};

// should OrderCursor be able to go the next one
// and return you the value
// that makes more sense
// if no more, no more cursor
// so we can go from one thing to another
// OR we mutate the current cursor value when we get the next value

interface OrderCursorI<elem> {
  get (): elem;
  next (): ?OrderCursorI;
}

// the cursor points to something
// what is that something?
// you need to be able to get the next order entry
// conver the cursor to index, gapkey and entry
// but the gap key is not part of the order entry
// the OrderEntry is not generic

// if something that impleemnts OrderIndexI chooses the cursor type
// that cursor type has an interface of some sort
// because we need to be able to iterate around it?

interface OrderIndexI<link, cursor: OrdexCursorI> {
  findCursor (link): cursor; // this is find
  isBefore (cursor, cursor): boolean;
  adjustLevel (cursor): any;
}

export type { OrderIndexI, OrderCursorI, OrderEntry };
