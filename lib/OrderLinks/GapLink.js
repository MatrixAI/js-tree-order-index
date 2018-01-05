// @flow

import type { OrderLinkI } from '../OrderLink.js';

// this gaplink has to point to something
// but that something has to have a type
// that type depends on the order index


class GapLink<link> implements OrderLinkI<link> {
  _link: { block, number };

  _block: t;
  _gapKey: number;
  constructor (gapKey: number) {
    this._gapKey = gapKey;
  }

  updateLink (link) {
    this._link = link;
  }

  updateBlock (block): void {
    this._block = block;
    return;
  }
  updateGapKey (gapKey: number): void {
    this._gapKey = gapKey;
    return;
  }
}

export default GapLink;
