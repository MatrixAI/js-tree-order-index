// @flow

import type { OrderLink } from '../OrderLink.js';

type GapKey = number;

class GapLink implements OrderLink {
  _gapKey: GapKey;
  constructor (gapKey: GapKey) {
    this._gapKey = gapKey;
  }
  find () {
  }
}

export default GapLink;

export type { GapKey };
