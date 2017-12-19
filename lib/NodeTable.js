//@flow

import type { orderLink } from './OrderLinks.js';

type node<L> = {
  id: number,
  lower: L,
  upper: L
};

interface NodeTableInterface<L: orderLink> {
  insert (nodeOrig: Object, lower: L, upper: L): [number, node<L>];
  lookupById (id: number): ?node<L>;
  deleteById (id: number): any;
  setLinksById (id: number, lower: ?L, upper: ?L): any;
}

export type { node, NodeTableInterface };
