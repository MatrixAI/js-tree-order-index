// @flow

import type { OrderLinkI } from './OrderLink.js';
import type { OrderEntry } from './OrderEntry.js';

interface OrderIndexI<id, link: OrderLinkI<id>> {
  getNodeId (OrderEntry<id>): id;
  findEntry (link): OrderEntry<id>;
  isOpening (OrderEntry<id>): boolean;
  isBefore (OrderEntry<id>, OrderEntry<id>): boolean;
  nextEntry (OrderEntry<id>): OrderEntry<id>;
  adjustLevel (OrderEntry<id>);
}

export type { OrderIndexI };
