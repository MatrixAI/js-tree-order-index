// @flow

import type { OrderLinkI } from './OrderLink.js';
import type { OrderEntry } from './OrderEntry.js';

interface OrderIndexI<link: OrderLinkI> {
  getNodeId (OrderEntry): number;
  findEntry (link): OrderEntry;
  isOpening (OrderEntry): boolean;
  isBefore (OrderEntry, OrderEntry): boolean;
  nextEntry (OrderEntry): OrderEntry;
  adjustLevel (OrderEntry);
}

export type { OrderIndexI };
