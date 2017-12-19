// @flow

import type { OrderIndexInterface } from '../OrderIndex.js';

class Block {

  parent: ?Block;
  levelDelta: number;

  constructor (parent: ?Block, levelDelta: number = 0) {
    this.parent = parent;
    this.levelDelta = 0;
  }

}

function setupBlockConstructors (blockSize: number) {

  class Leaf extends Block {
    
  }

  class Node extends Block {
    
  }

  return {
    Leaf: Leaf,
    Node: Node
  }

}

class BOTree implements OrderIndexInterface {

  _blockConst: { Leaf: Class<Block>, Node: Class<Block> };

  constructor (blockSize: number = 64) {
    if (blockSize % 2 !== 0) {
      throw new RangeError('blockSize must be even for even splitting');
    }
    if (blockSize < 2) {
      throw new RangeError('blockSize must be greater than 2 for splitting');
    }
    this._blockConst = setupBlockConstructors(blockSize);
  }

}

export default BOTree;
