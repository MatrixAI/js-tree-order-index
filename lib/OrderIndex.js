// @flow

type OrderEntry = {
  id: number;
  status: boolean;
};

interface OrderIndexI<link> {
  getNodeId (OrderEntry): number;
  findEntry (link): OrderEntry;
  isOpening (OrderEntry): boolean;
  isBefore (OrderEntry, OrderEntry): boolean;
  nextEntry (OrderEntry): OrderEntry;
  adjustLevel (OrderEntry);
}

export type { OrderIndexI, OrderEntry };
