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
  _levelDelta: number;
  _parentNode: ?Node;
  _children: Array<child>;
  _lastIndex: ?number;

  constructor (
    nodeTable: NodeTableI<link>,
    blockSize: number,
    levelDelta: number,
    parentNode: ?Node,
    children: ?Array<child>
  ) {
    this._nodeTable = nodeTable;
    this._levelDelta = levelDelta;
    this._parentNode = parentNode;
    if (children && children.length > 1) {
      this._children = children;
      this._children.length = blockSize;
      this._lastIndex = children.length - 1;
    } else {
      this._children = new Array(blockSize);
      this._lastIndex = null;
    }
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

  _gapSize: number;
  _nextLeaf: ?Leaf;

  constructor (
    nodeTable: NodeTableI,
    blockSize: number,
    levelDelta: number = 0,
    parentNode: ?Node,
    children: ?Array<{key: number, entry: OrderEntry}>,
    nextLeaf: Leaf = null
  ) {
    super(nodeTable, blockSize, levelDelta, parentNode, children);
    this._gapSize = Math.floor(Number.MAX_SAFE_INTEGER / blockSize);
    this._nextLeaf = nextLeaf;
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

  // rebalancing is strange
  // as we can do merging and splitting of blocks
  // merging blocks requires relabelling the gap keys
  // but splitting blocks doesn't
  _rebalance () {

  }

  // we expect that when you reach here to insert an entry into the order index
  // the node must already exist in the node table
  // so you must always insert into node table first before into the order index tree
  insertEntry (position: number, orderEntry: OrderEntry): void {
    if (this._lastIndex + 1 === blockSize) {

      // the actual number of elements depends on where you want insert it into
      // because maybe you want to insert into the left most element
      // then this new element should be considered the first element
      // and the splitIndex needs to count that
      // so the array that we are splitting is not this._children
      // but the would-be inserted children array
      // but is that efficient?
      // isn't it better to create another array with the same block size
      // and fill it accordingly
      // so maybe since it's a realloc anyway
      // the problem is that there's a temporary array allocation only for the purpose of doing this
      // this new leaf should have the same parent for now..
      // and but the parent may be rebalanced
      // so ok, where would we insert this entry if we could?

      // this would be where we could insert it if we could
      // so this gives us the the really last index
      // if length was 10, this could give us 10 if it was the rightmost insertion
      // which would produce the 11th element
      position = boundIndex(position, this._lastIndex);

      // length + 1 due to the new entry
      // deal with odd (length + 1) by leaving more on the left
      // and less on the right
      // convert it to an index by minusing 1
      const splitIndex = Math.ceil((this._children.length + 1) / 2) - 1;

      // the gapkeys may be the same
      // or what...?
      // ok we do need to work  this out

      const childPrev = this._children[position - 1];
      const childNext = this._children[position];
      let newGapKey;
      if (childPrev && childNext) {
        newGapKey = Math.floor((childPrev.key + childNext.key) / 2);
      } else if (childPrev) {
        newGapKey = Math.floor((childPrev.key + Number.MAX_SAFE_INTEGER) / 2);
      } else if (nextEntry) {
        newGapKey = Math.floor((0 + Number.MAX_SAFE_INTEGER) / 2);
      }

      if (position === splitIndex) {
        // new entry is on the right most of the left split
        // gapkey check only checks if childPrev
        if (childPrev && (newGapKey === childPrev.key)) {
          // relabel!
        }
      } else if (position + 1 === splitIndex) {
        // new entry is on the left most of the right split
        if (childNext && (newGapKey === childNext.key)) {
          // relabel!
        }
      } else {
        if (
          (childPrev && (newGapKey === childPrev.key)) ||
          (childNext && (newGapKey === childNext.key))
        ) {
          this._relabelGapKeys();
        }
      }

      // if we are on the splitIndex
      // we don't need to care about a particular element


      // we now know where it should be if we could insert it
      // note that inserting in the middle may still require relabelling the gap keys

      const newLeaf = new Leaf(
        this._nodeTable,
        this._children.length,
        0,
        this._parentNode,
      );
      this._nextLeaf = newLeaf; // not sure how to do this recursively yet
      this._parent.insertChild(newLeaf); // somehow we need to do this

      // then you fill out the newLeaf's internal elements
      // during construction
      // cause you now know

      // the main idea is we have to know where this would be inserted if it could be inserted
      // and do we relabel the gap keys at all?
      // only if we need to, otherwise it's not a problem


      const newChildren = array.slice(splitIndex);
      this._children.fill(undefined, splitIndex);





      // split tree!
      // how do we split
      // we already know where the record must go
      // it is specified by position here and we are in the leaf
      // split the bucket
      // original node has [L+1]/2 items (ceil)
      // new node has L+1/2 (floor)
      // where L is the number of records
      // if 10 items 10 + 1 = 11
      // 11 / 2 = 5.5 => 6
      // 11 / 2 = 5.5 => 5
      // move the
      // 10 + 1 (1 new element)



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

      // when inserting an order entry into the order index
      // we expect that the entry already has a node id
      // where the node id leads us to the table
      // however the table expects that new nodes when inserted
      // already have the correct links
      // that is the links into the order index
      // thus assuming that the entries are already inserted into
      // so it's a chicken or egg problem
      // right now insertion into the node table requires links
      // but to have links you need entries
      // but to insert an entry, you need to update its links to point to the entry
      // what we need to do is to abstract this synchronisation
      // that is inserting into order index shouldn't require that the entry has a valid
      // node id with valid links to the order entry
      // and insertion in to node table shouldn't require that the links are preformed

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
    parentNode: ?Node,
    children: ?Array<Leaf | Node>,
  ) {
    super(nodeTable, blockSize, levelDelta, parentNode, children);
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

  constructor (nodeTable: NodeTableI<GapLink, any>, blockSize: number = 64) {
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
