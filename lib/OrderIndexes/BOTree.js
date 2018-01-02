// @flow

import type { OrderIndexI } from '../OrderIndex.js';
import type { OrderLinkI } from '../OrderLink.js';
import type { OrderEntry } from '../OrderEntry.js';
import type GapLink, { GapKey } from '../OrderLinks/GapLink.js';

class Block {

  _parent: ?Block;
  _levelDelta: number;

  constructor (parent: ?Block, levelDelta: number) {
    this._parent = parent;
    this._levelDelta = levelDelta;
  }

}

function setupBlockConstructors (blockSize: number) {

  class Leaf extends Block {

    _next: ?Leaf;
    _entries: Array<[GapKey, OrderEntry]>;

    constructor (
      parent: ?Node,
      levelDelta: number,
      next: Leaf = null
    ) {
      super(parent, levelDelta);
      this._nextLeaf = next;
      this._entries = new Array(blockSize);
    }

    getFirstLeaf (): Leaf {
      return this;
    }

    getNextLeaf () {
      return this._next;
    }

    getEntries (): Array<[GapKey, OrderEntry]> {
      return this._entries;
    }

    setNextLeaf (next) {
      this._next = next;
    }

  }

  class Node extends Block {

    _children: Array<Block>;

    constructor (parent: ?Node, levelDelta: number) {
      super(parent, levelDelta);
      this._children = new Array(blockSize);
    }

    getFirstLeaf (): Leaf {
      // children must always be filled with at least one
      return this.children[0].first();
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

class BOTree<link: GapLink<id>> implements OrderIndexI<link> {

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

  getNodeId (entry: OrderEntry): number {
    return entry.id;
  }

  // there's also take a node and give back the entry
  // takes a link and gives back entry
  findEntry (link: link): OrderEntry {
    // do something with the link
  }

  isOpening (entry: OrderEntry): boolean {
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

  [Symbol.iterator] () {
    let leaf = this._root.getFirstLeaf();
    let leafEntries = leaf.getEntries();
    let leafEntriesIndex = 0;
    let leafEntry = leafEntries[leafEntriesIndex];
    return {
      next: () => {
        let orderEntry;
        if (leafEntry) {
          [_, orderEntry] = leafEntry;
          ++leafEntriesIndex;
          if (leafEntries[leafEntriesIndex]) {
            leafEntry = leafEntries[leafEntriesIndex];
          } else {
            leaf = leaf.getNextLeaf();
            if (leaf) {
              leafEntries = leaf.getEntries();
              leafEntriesIndex = 0;
              leafEntry = leafEntries[leafEntriesIndex];
            } else {
              leafEntry = null;
            }
          }
        }
        return {
          done: !!orderEntry,
          value: orderEntry
        };
      }
    };
  }

}

export default BOTree;
