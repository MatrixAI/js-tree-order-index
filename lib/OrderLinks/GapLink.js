// @flow

class GapLink<Block> {

  _block: Block;
  _gapKey: number;

  constructor (block: Block, gapKey: number) {
    this._block = block;
    this._gapKey = gapKey;
  }

}

export default GapLink;
