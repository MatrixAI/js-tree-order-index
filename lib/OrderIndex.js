// @flow

// orderEntry is a cursor into the order index tree (BOTree) for example
// the orderLink is the thing that's stored between the table and the order index tree
// the table doesn't know about order entries at all
// it only stores order links
// order links are the just unions in this case

type OrderEntry<id> = {
  id: id;
  opening: boolean;
};

interface OrderIndexInterface<id, link: OrderLink> {
  getNodeId (OrderEntry<id>): id;
  findEntry (link): OrderEntry;
  isOpening (OrderEntry<id>): boolean;
  isBefore (OrderEntry<id>, OrderEntry<id>): boolean;
  nextEntry (OrderEntry<id>): OrderEntry<id>;
  adjustLevel (OrderEntry<id>);
}

export type { OrderIndexInterface, OrderEntry };
