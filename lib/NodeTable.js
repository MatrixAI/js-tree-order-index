//@flow

import type { orderLink } from './OrderLinks.js';

type node<link> = {
  id: number,
  level: number,
  opening: link,
  closing: link
};

interface NodeTableI<link: OrderLinkI> {
  insert (nodeOrig: Object, lower: L, upper: L): [number, node<link>];
  lookupById (id: number): ?node<link>;
  deleteById (id: number): any;
  setLinksById (id: number, lower: ?link, upper: ?link): any;
}

export type { NodeTableI, node };
