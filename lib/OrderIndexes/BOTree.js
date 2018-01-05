// @flow

import type { OrderLinkI } from '../OrderLink.js';
import type { OrderIndexI } from '../OrderIndex.js';
import type { NodeTableI } from '../NodeTable.js';
import type { OrderEntry } from '../OrderEntry.js';

import typeof GapLink from '../OrderLinks/GapLink.js';

// the js splice function already does bounding
// however it does it slightly strangely
//             [1,  2,  3]
// has indexes
// positive:  0,  1,  2,  3
// negative: -3, -2, -1
// whereas we want
// positive:  0,  1,  2,  3
// negative: -4, -3, -2, -1
// with shift = true
// we use this boundIndex to achieve the correct splicing operation we want
// so position is a representation of the in-between index
// i think my way makes more sense and is more useful position index
function boundIndex (
  position: number,
  lastIndex: number,
  shift: boolean = true
) {
  if (lastIndex < 0) throw RangeError('lastIndex cannot be less than 0');
  if (position < 0) {
    const lastIndexNegative = -(lastIndex + 2);
    if (position < lastIndexNegative) {
      position = lastIndexNegative;
    }
  } else if (position > lastIndex) {
    position = lastIndex + 1;
  }
  if (shift && position < 0) {
    position += lastIndex + 2;
  }
  return position;
}

class Block<link, child> {

  _nodeTable: NodeTableI<link>;
  _children: Array<child>;
  _levelDelta: number;
  _parentNode: ?Node;
  _lastIndex: ?number;

  constructor (
    nodeTable: NodeTableI<link>,
    blockSize: number,
    levelDelta: number,
    parentNode: ?Node
  ) {
    this._nodeTable = nodeTable;
    this._children = new Array(blockSize);
    this._levelDelta = levelDelta;
    this._parentNode = parentNode;
    this._lastIndex = null;
  }

  [Symbol.iterator] (): Iterator<child> {
    return this._children.entries();
  }

  getParent (): ?Node {
    return this._parentNode;
  }

  getChildByIndex (index: number): ?child {
    return this._children[index];
  }

  getChildByPos (position: number): ?child {
    if (typeof this._lastIndex === 'number') {
      position = boundIndex(position, this._lastIndex);
      return this.getEntryByIndex(position);
    }
    return null;
  }

}

class Leaf extends Block<GapLink, {key: number, entry: OrderEntry}> {

  _nextLeaf: ?Leaf;
  _gapSize: number;

  constructor (
    nodeTable: NodeTableI,
    blockSize: number,
    levelDelta: number = 0,
    parentNode: ?Node,
    nextLeaf: Leaf = null
  ) {
    super(nodeTable, blockSize, levelDelta, parentNode);
    this._nextLeaf = nextLeaf;
    this._gapSize = Math.floor(Number.MAX_SAFE_INTEGER / blockSize);
  }

  getFirstLeaf (): Leaf<link> {
    return this;
  }

  getLastLeaf (): Leaf<link> {
    return this;
  }

  getNextLeaf (): ?Leaf<link> {
    return this._next;
  }

  setNextLeaf (nextLeaf: Leaf<link>) {
    this._nextLeaf = next;
  }

  getEntryByIndex (index: number): ?OrderEntry {
    const child = this.getChildByIndex(index);
    if (child) return child.entry;
    return null;
  }

  getEntryByPos (position: number): ?OrderEntry {
    const child = this.getChildByPos(index);
    if (child) return child.entry;
    return null;
  }

  // we expect that when you reach here to insert an entry into the order index
  // the node must already exist in the node table
  // so you must always insert into node table first before into the order index tree
  insertEntry (position: number, orderEntry: OrderEntry): void {
    if (this._lastIndex + 1 === blockSize) {
      // split tree!
    } else {
      position = boundIndex(position, this._lastIndex);
      const childPrev = this._children[position - 1];
      const childNext = this._children[position];
      let newGapKey;
      if (childPrev && childNext) {
        newGapKey = Math.floor((childPrev.key + childNext.key) / 2);
      } else if (childPrev) {
        newGapKey = Math.floor((childPrev.key + Number.MAX_SAFE_INTEGER) / 2);
      } else if (nextEntry) {
        newGapKey = Math.floor((0 + Number.MAX_SAFE_INTEGER) / 2);
      } else {
        newGapKey = this._gapSize;
      }
      if (
        (childPrev && (newGapKey === childPrev.key)) ||
        (childNext && (newGapKey === childNext.key))
      ) {
        this._relabelGapKeys();
        return this.insertEntry(entry, position);
      }
      if (this._updateLink(orderEntry, this, newGapKey)) {
        this._children.splice(position, 0, [newGapKey, orderEntry]);
      } else {
        throw new Error('OrderIndex has an entry that does not exist in the NodeTable');
      }
    }
    return;
  }

  _relabelGapKeys (): void {
    for (
      let i = 0, newGapKey = this._gapSize;
      i < this._lastIndex;
      ++i, newGapKey += this._gapSize
    ) {
      const child = this._children[i];
      child.key = newGapKey;
      if (!this._updateLink(child.entry, null, newGapKey)) {
        throw new Error('OrderIndex has an entry that does not exist in the NodeTable');
      }
    }
    return;
  }

  _updateLink (orderEntry: OrderEntry, newLeaf: ?Leaf, newGapKey: ?number): boolean {
    const node = this._nodeTable.getNodeById(orderEntry.id);
    if (node) {
      let link;
      if (orderEntry.status) {
        link = node.opening;
      } else {
        link = node.closing;
      }

      // something like this could work
      // so that you make sure that GapLink implements a "generic" link
      // that is simply that the interfaces can update links that's the main thing here
      // otherwise they can be any type
      link.updateLink({...link.getLink(), block: newLeaf, gapKey: newGapKey });


      link.updateLink([newLeaf, newGapKey]);

      if (newLeaf) link.updateBlock(newLeaf);
      if (typeof newGapKey === 'number') link.updateGapKey(newGapKey);
      return true;
    }
    return false;
  }

}

class Node extends Block<GapLink, Leaf | Node> {

  constructor (
    nodeTable: NodeTableI<GapLink>,
    blockSize: number,
    levelDelta: number = 0,
    parentNode: ?Node
  ) {
    super(nodeTable, blockSize, levelDelta, parentNode);
  }

  getFirstLeaf (): ?Leaf {
    if (this.children[0]) {
      return this.children[0].getFirstLeaf();
    }
    return null;
  }

  getLastLeaf (): ?Leaf {
    if (this.children[this._lastChildIndex]) {
      return this.children[this._lastChildIndex].getLastLeaf();
    }
    return null;
  }

}

class BOTree implements OrderIndexI<GapLink> {

  _nodeTable: NodeTableI<GapLink>;
  _blockSize: number;
  _root: Leaf | Node;

  constructor (nodeTable: NodeTableI<GapLink>, blockSize: number = 64) {
    if (blockSize % 2 !== 0) {
      throw new RangeError('blockSize must be even for even splitting');
    }
    if (blockSize < 2) {
      throw new RangeError('blockSize must be greater than 2 for splitting');
    }
    this._nodeTable = nodeTable;
    this._blockSize = blockSize;
    this._root = new Leaf(nodeTable, blockSize);
  }

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

  [Symbol.iterator] (): Iterator<OrderEntry> {
    let leaf = this._root.getFirstLeaf();
    let leafIterator = (leaf) ? leaf[Symbol.iterator]() : null;
    const next = () => {
      if (leaf && leafIterator) {
        const { value: child } = leafIterator.next();
        if (child) {
          const [, { entry: orderEntry }] = child;
          if (orderEntry) {
            return {
              done: false,
              value: orderEntry
            }
          }
        }
        leaf = leaf.getNextLeaf();
        leafIterator = (leaf) ? leaf[Symbol.iterator]() : null;
        return next();
      } else {
        return {
          done: true,
          value: undefined
        }
      }
    };
    return {
      next: next
    };
  }

}

export default BOTree;
