// @flow

import type { OrderLink } from '../OrderLink.js';

class GapLink<id> implements OrderLink<id> {
  _gapKey: number;
  constructor (gapKey: number) {
    this._gapKey = gapKey;
  }
  find () {
  }
}

export default GapLink;

