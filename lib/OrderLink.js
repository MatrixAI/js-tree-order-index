//@flow

import type { OrderEntry } from './OrderEntry.js';

interface OrderLinkI {
  getEntry (): OrderEntry;
};

export type { OrderLinkI };
