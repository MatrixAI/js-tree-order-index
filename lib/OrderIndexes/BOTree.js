// @flow

import type { OrderIndexI } from '../OrderIndex.js';
import type { OrderLinkI } from '../OrderLink.js';
import type { OrderEntry } from '../OrderEntry.js';

class Block {

  parent: ?Block;
  levelDelta: number;

  constructor (parent: ?Block, levelDelta: number) {
    this.parent = parent;
    this.levelDelta = levelDelta;
  }

}

function setupBlockConstructors (blockSize: number) {

  class Leaf extends Block {

    nextLeaf: ?Leaf;
    entries: Map<number, OrderEntry>; // this forces the usage of GapLink
    // or the usage of a number
    // if you want to optimise on space, you use an array of 2 tuples
    // and you perform a binary search or interpolation search
    // if you want optimise on just simplicity
    // then just use Map and assume that it's performant
    // then it's the same thing basically
    // insertion may involve relabeling
    // relabelling a map may be more complicated
    // because you'd have to remove the key value pair
    // and then insert it again
    // that's what makes it kind of bad...
    // so if we instead use entries Array<OrderEntry>
    // but then we need to say that OrderEntry key is both the node id
    // and also opening/closing
    // and also a potential number for gap key
    // ok I'm going to use a straight forward array instead
    // and the OrderEntry is going to be parameterised on the id type?
    // but what does it really mean!???!?
    entries: Array<OrderEntry>;

    constructor (
      parent: Node,
      levelDelta: number,
      nextLeaf: Leaf = null
    ) {
      super(parent, levelDelta);
      this.nextLeaf = nextLeaf;
    }

    // get the first one
    // if we are the leaf, then return it
    first () {
      return this;
    }

  }

  class Node extends Block {

    children: Array<Block>;
    _first: ?Block;
    _last: ?Block;

    constructor (parent: ?Node, levelDelta: number) {
      super(parent, levelDelta);
      this.children = new Array(blockSize);
      this._first = this.children[0];
      this._last = this.children[0];
    }

    first () {
      // this may not actually exist
      // although that's not really allowed
      // since we are saying that the array may contain nothing
      // so maybe instead we maintain head and last
      return this.children[0].first();
    }

    last () {
      // last one isn't the last one in the array
      // it's the last one that isn't filled
      return this.children[this.children.length - 1];

    }

  }

  return {
    Leaf: Leaf,
    Node: Node
  }

}

// insertion into the BOTree needs to understand what the id is
// ok so what we are saying is that the BOTree only implements using the GapLink
// because if you are adding keys
// you need to know this directly!
// so how do we do this?
// unless we are saying that BOTree link must be of GapLink
// here we are saying that BOTree must use GapLink since that's what it was made for
// but it can be a subtype of GapLink or GapLink itself
// point is that the key must be used!
// since we expect a GapLink to have a gapkey
//
// here we are saying that this BOTree implementation only works with GapLink
// because of the usage of gap keys in the leaf block entries

class BOTree<id, link: GapLink<id>> implements OrderIndexI<id, link> {

  _blockConst: { Leaf: Class<Block>, Node: Class<Block> };
  _root: Block;

  constructor (blockSize: number = 64) {
    if (blockSize % 2 !== 0) {
      throw new RangeError('blockSize must be even for even splitting');
    }
    if (blockSize < 2) {
      throw new RangeError('blockSize must be greater than 2 for splitting');
    }
    this._blockConst = setupBlockConstructors(blockSize);
    this._root = new this._blockConst.Leaf(null, 0);
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

  // this function is called within for-of
  // this means we get an iterator of the entire tree
  // and we iterate from the very first leaf block
  [Symbol.iterator] () {

    // first block
    const firstLeaf = this._root.first();


    // from the _root, navigate to the left most leaf block
    // then next returns the value, while pushing the value out
    // we use a closure here to retain the pointer to the right node
    let currentBlock = this._root;
    let currentCursor = null; // actually maintain cursor that allows us to move
    return {
      next: () => {
        // work with the currentBlock, and get the value and push it out
        const value = null; // based on the currentBlock
        // currentBlock = ...? next block
        // currentCursor
        return {
          done: false,
          value: value
        };
      }
    };
  }


  // here we must then use L
  // as this class methods are generic over the link types
  // however we cannot allow multiusage of these link types
  // it must be one of the types
  // this thing is a bit weird since I can't really say a strict subtype

}

export default BOTree;
