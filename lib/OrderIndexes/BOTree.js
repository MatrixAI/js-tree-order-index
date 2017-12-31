// @flow

import type {
  OrderIndexInterface.
  OrderEntry
} from '../OrderIndex.js';

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

// insertion into the BOTree needs to understand what the id is

class BOTree<id, link: *> implements OrderIndexInterface<id, link> {

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

  // leaf blocks contain the actual OrderEntry
  // this means in order to navigate to the next OrderEntry
  // we don't want to store pointers into each
  // we need to be able to ACQUIRE the poisition into the block
  // so before(e1, e2) means somehow e1 and e2 are also representations o f pointers, not just objects...
  // it is the backlink that allows us to figure this out
  // this means e1 and e2 needs to store the backlink as well?

  getNodeId (entry: OrderEntry<id>): id {
    return entry.id;
  }

  // there's also take a node and give back the entry
  // takes a link and gives back entry
  findEntry (link: link): OrderEntry<id> {
    // do something with the link
  }

  isOpening (entry: OrderEntry<id>): boolean {
    return entry.opening;
  }

  isBefore (entry1: OrderEntry<id>, entry2: OrderEntry<id>): boolean {
    // check the numbers in between
    // remember we are doing traversal over a B+tree
  }

  nextEntry (entry: OrderEntry<id>): OrderEntry<id> {
    // basic traversal of the tree
    // this depends on b+tree travsersal
  }


  // here we must then use L
  // as this class methods are generic over the link types
  // however we cannot allow multiusage of these link types
  // it must be one of the types
  // this thing is a bit weird since I can't really say a strict subtype

}

export default BOTree;
