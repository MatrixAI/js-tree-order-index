// @flow

class GapLink<Block> {

  _block: Block;
  _gapKey: number;

  constructor (block: Block, gapKey: number) {
    this._block = block;
    this._gapKey = gapKey;
  }

  getBlock () {
    return this._block;
  }

  getGapKey () {
    return this._gapKey;
  }

}

export default GapLink;
