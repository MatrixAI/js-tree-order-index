// @flow

import type { OrderLinkI } from '../OrderLink.js';
import type { OrderIndexI } from '../OrderIndex.js';
import type { NodeTableI } from '../NodeTable.js';
import type { OrderEntry } from '../OrderEntry.js';

import type GapLink, { GapKey } from '../OrderLinks/GapLink.js';

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

class Block<child> {

  _children: Array<child>;
  _levelDelta: number;
  _parentNode: ?Node;
  _lastIndex: ?number;

  constructor (blockSize: number, levelDelta: number, parentNode: ?Node) {
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

class Leaf extends Block<{key: GapKey, entry: OrderEntry}> {

  _nextLeaf: ?Leaf;
  _gapSize: number;

  constructor (
    blockSize: number,
    levelDelta: number = 0,
    parentNode: ?Node,
    nextLeaf: Leaf = null
  ) {
    super(blockSize, levelDelta, parentNode);
    this._nextLeaf = nextLeaf;
    this._gapSize = Math.floor(Number.MAX_SAFE_INTEGER / blockSize);
  }

  getFirstLeaf (): Leaf {
    return this;
  }

  getLastLeaf (): Leaf {
    return this;
  }

  getNextLeaf (): ?Leaf {
    return this._next;
  }

  setNextLeaf (nextLeaf) {
    this._nextLeaf = next;
  }

  // we only do this internally
  _relabelGapKeys () {
    for (
      let i = 0, newGapKey = this._gapSize;
      i < this._lastIndex;
      ++i, newGapKey += this._gapSize
    ) {
      const child = this._children[i];
      child.key = newGapKey;
      const node = nodeTable.getNodeById(child.entry.id);
      if (node) {
        if (gapKeyEntry.status) {
          node.opening.updateGapKey(newGapKey);
        } else {
          node.closing.updateGapKey(newGapKey);
        }
      } else {
        throw new Error('OrderIndex has an entry that does not exist in the NodeTable');
      }
    }
    return;
  }

  // what is the gap key intended to be?
  // ok, so insertion into the BOTree starts at the leafs first
  // we don't navigate to the beginning from the root and insert
  // insertion already knows which gap key we want to insert at
  // because insertion is always about inserting after or before some gap key
  // so it involves a search into the keyspace and inserting there into the array, with array relocation
  // insert into the tree index means insert_leaf(node, position)
  // position means both the parent, and index into the parent's children
  // the position would lead us to the parent node
  // which in this case means a nested interval embedded into this B+tree
  // at a leaf position, you may want to insert an order entry
  // this means you need a position number
  // this position index indexes into to array of entries
  // we need to realise how this interacts with splitting of the blocks
  // furthermore since we using GapKeys
  // the GapKey also matters
  // infact it the primary way of inserting...
  // but we don't actually know what the gap key should be?
  insertEntry (entry: OrderEntry, position: number) {

    position = boundIndex(position, 0, this._lastEntryIndex);

    if (this._lastEntryIndex + 1 === blockSize) {

      // we need ot split, there's no space left

    } else {

      let gapKey;
      const prevEntry = this._entries[position - 1];
      const nextEntry = this._entries[position + 1];

      if (prevEntry && nextEntry) {

        gapKey = Math.floor((prevEntry[0] + nextEntry[0]) / 2);

        if (gapKey === prevEntry[0]) {
          // we need to shift, we have no space!!
          // relabel all nodes
          // so this just means recalculate from the beginning from the end
        }


        gapKey = Math.floor((prevEntry[0] + Number.MAX_SAFE_INTEGER) / 2);

        if (gapKey === prevEntry[0]) {
          // we need to relabel
        }


      } else if (nextEntry) {
        gapKey = Math.floor((0 + nextEntry[0]) / 2);
        if (gapKey === 0) {
          // we need to relabel
          // when you relabel you need to reassign from the node table
          // it contains all the gap keys as well
          // so how do you go from block to node table?
          // you use the node id
          // that's right

        }

      }


      // find out what my gapkey should be?
      const gapKey = 0;
      this.entries.splice(position, 0, [0, entry]);

      // if we are in-between, we take the arithmetic mean
      // if we are at one of the empty positions
      // then we take the arithmetic mean between the left
      // and the maximum number
      // oh wait.. that's a dumb idea
      // we want to know what the keyspace size is
      // we know that our numbers are roughly 32 bit
      // the maximum safe integer is 2^53 - 1
      // so we know that's our maximum gap key size
      //
      // Number.MAX_SAFE_INTEGER
      // is the highest number we can use for a gap key
      // simple the last theoretial key would be that number
      // and then we divide by block size and round down
      // Math.floor(Number.MAX_SAFE_INTEGER / 64)

      // it turns out that gapkeys are in the inner blocks as well
      // rather than just child pointers, there are also gap keys for node blocks
      // what are these gap keys for though?
      // why would inner blocks have gap keys?


    }

    // we may also need to relabel gaps




    // [ E1, E2, undefined, undefined, undefined ]
    // this means valid positions are 0, 1, 2
    // you cannot insert ahead... of anything
    // so what we can do is insert, and then flatten
    // i mean push it all the left
    // or readjust the numbers accordingly
    // this means we do need to know the first and last element

    // a number that must then perform a split if necessary
    // also we are doing it only at a leaf
    // because backlinks always point to a Leaf
    // we always know what the entiresFIrst


  }

}

class Node extends Block<Leaf | Node> {

  constructor (
    blockSize: number,
    levelDelta: number = 0,
    parentNode: ?Node
  ) {
    super(blockSize, levelDelta, parentNode);
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

  _blockSize: number;
  _gapSize: number;
  _root: Leaf | Node;
  _nodeTable: NodeTableI;

  constructor (blockSize: number = 64, nodeTable: NodeTableI) {
    if (blockSize % 2 !== 0) {
      throw new RangeError('blockSize must be even for even splitting');
    }
    if (blockSize < 2) {
      throw new RangeError('blockSize must be greater than 2 for splitting');
    }
    this._blockSize = blockSize;

    this._gapSize = Math.floor(Number.MAX_SAFE_INTEGER / blockSize);
    // the gap size is already calculated pre-calculated each time
    // it is always based on the block size
    // so once you know the block size you know the gap size

    this._root = new Leaf(null, 0);

    this._nodeTable = nodeTable;
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

  [Symbol.iterator] (): Iterator<OrderEntry> {
    let leaf = this._root.getFirstLeaf();
    let leafIterator = (leaf) ? leaf[Symbol.iterator]() : null;
    const next = () => {
      if (leaf && leafIterator) {
        let { value: child } = leafIterator.next();
        let orderEntry;
        if (child) {
          [, { entry: orderEntry }] = child;
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
