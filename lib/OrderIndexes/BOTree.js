// @flow

import type { OrderEntry, OrderIndexI } from '../OrderIndex.js';

import GapLink from '../OrderLinks/GapLink.js';
import { interpolationSearch, boundIndex } from '../utilities.js';

class Cursor {
  _leaf: Leaf;
  _index: number;
  constructor (leaf, index) {
    this._leaf = leaf;
    this._index = index;
  }
  getLeaf () {
    return this._leaf;
  }
  getIndex () {
    return this._index;
  }
}

class Block<child> {

  _levelDelta: number;
  _parentNode: ?Node;
  _children: Array<child>;
  _lastIndex: ?number;

  constructor (
    blockSize: number,
    levelDelta: number,
    parentNode: ?Node,
    children: ?Array<child>
  ) {
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

  [Symbol.iterator] (): Iterator<[number, child]> {
    return this._children.entries();
  }

  getParent (): ?Node {
    return this._parentNode;
  }

  getChildren (): Array<children> {
    return this._children;
  }

  getChildrenLength (): number {
    if (this._lastIndex != null) {
      return this._lastIndex + 1;
    } else {
      return 0;
    }
  }

  getChildByIndex (index: number): ?child {
    return this._children[index];
  }

}

class Leaf extends Block<{key: number, entry: OrderEntry}> {

  _gapSize: number;
  _nodeTable: NodeTableI<GapLink<Leaf>, *>;
  _leafNext: ?Leaf;
  _leafPrev: ?Leaf;

  constructor (
    blockSize: number,
    levelDelta: number = 0,
    parentNode: ?Node,
    children: ?Array<{key: number, entry: OrderEntry}>,
    nodeTable: NodeTableI<GapLink<Leaf>, *>,
    leafNext: Leaf = null,
    leafPrev: Leaf = null
  ) {
    super(blockSize, levelDelta, parentNode, children);
    this._gapSize = Math.floor(Number.MAX_SAFE_INTEGER / blockSize + 1);
    this._nodeTable = nodeTable;
    this._leafNext = leafNext;
    this._leafPrev = leafPrev;
  }

  getLeafFirst (): Leaf {
    return this;
  }

  getLeafLast (): Leaf {
    return this;
  }

  getLeafNext (): ?Leaf {
    return this._leafNext;
  }

  setLeafNext (leafNext: Leaf): void {
    this._leafNext = leafNext;
    return;
  }

  getLeafPrev (): ?Leaf {
    return this._leafPrev;
  }

  setLeafPrev (leafPrev: Leaf): void {
    this._leafPrev = leafPrev;
    return;
  }

  getChildByKey (key: number): ?[number, OrderEntry] {
    if (this._lastIndex == null) {
      return null;
    }
    const [index, cost] = interpolationSearch(
      key,
      this._lastIndex,
      (index) => this._children[index].key
    );
    if (cost > Math.log2(this._children.length)) {
      this._relabelGapKeys();
    }
    if (index != null) {
      return [index, this._children[index].entry];
    }
    return null;
  }

  // rebalancing is strange
  // as we can do merging and splitting of blocks
  // merging blocks requires relabelling the gap keys
  // but splitting blocks doesn't
  _rebalance () {

  }

  insertEntry (
    orderEntry: OrderEntry,
    position: number
  ): [
    {key: number, entry: OrderEntry},
    Leaf,
    number
  ] {



    // the position number means where we want to insert it
    // we want to insert a single entry
    // somewhere according to position
    // but if there are

    if (this._lastIndex + 1 === blockSize) {

      // blocksize is full

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
      // so we do that, and then what happens?

      if (this._updateLink(orderEntry, this, newGapKey)) {
        this._children.splice(position, 0, [newGapKey, orderEntry]);
      } else {
        throw new Error('OrderIndex has an entry that does not exist in the NodeTable');
      }
    }
    return;
  }

  // can we separate this out into 2 loops
  // one that relabels the gapkeys
  // and one that relabels the gaplinks?
  _relabelGapKeys (): void {
    for (
      let i = 0, newGapKey = this._gapSize;
      i < this._lastIndex;
      ++i, newGapKey += this._gapSize
    ) {
      const child = this._children[i];
      child.key = newGapKey;
      if (child.entry.status) {
        this._updateLink(child.entry.id, [this, newGapKey]);
      } else {
        this._updateLink(child.entry.id, null, [this, newGapKey]);
      }
    }
    return;
  }

}

class Node extends Block<Leaf | Node> {

  constructor (
    blockSize: number,
    levelDelta: number = 0,
    parentNode: ?Node,
    children: ?Array<Leaf | Node>,
  ) {
    super(blockSize, levelDelta, parentNode, children);
  }

  getLeafFirst (): Leaf {
    const leaf = this._children[0];
    if (!leaf) {
      throw new Error('Node must always contain a first child');
    } else {
      return leaf.getLeafFirst();
    }
  }

  getLeafLast (): Leaf {
    if (!this._lastIndex) {
      throw new Error('Node must always contain a last child');
    }
    return this._children[this._lastIndex].getLeafLast();
  }

}

class BOTree implements OrderIndexI<GapLink<Leaf>, Cursor> {

  _nodeTable: NodeTableI<GapLink<Leaf>, *>;
  _blockSize: number;
  _root: Leaf | Node;

  constructor (
    nodeTable: NodeTableI<GapLink<Leaf>, *>,
    blockSize: number = 64
  ) {
    if (blockSize % 2 !== 0) {
      throw new RangeError('blockSize must be even for even splitting');
    }
    if (blockSize < 2) {
      throw new RangeError('blockSize must be greater than 2 for splitting');
    }
    this._nodeTable = nodeTable;
    this._blockSize = blockSize;
    this._root = new Leaf(blockSize, 0, null, null, nodeTable);
  }

  findCursor (link: GapLink<Leaf>): ?Cursor {
    const leaf = link.getBlock();
    const child = leaf.getChildByKey(leaf.getGapKey());
    if (child) return new Cursor(leaf, child[0]);
    return null;
  }

  getLink (cursor: Cursor): GapLink {
    const child = cursor.getLeaf().getChildByIndex(cursor.getIndex());
    if (child) return new GapLink(cursor.getLeaf(), child.key);
    throw new Error('Invalid cursor');
  }

  getEntry (cursor: Cursor): OrderEntry {
    const child = cursor.getLeaf().getChildByIndex(cursor.getIndex());
    if (child) return child.entry;
    throw new Error('Invalid cursor');
  }

  getCursorOpen (cursorClose: Cursor): Cursor {
    const entry = this.getEntry(cursorClose);
    if (entry.status) {
      throw new Error('Must be a closing cursor');
    }
    const node = this._nodeTable.getNodeById(entry.id);
    if (node && node.opening) {
      const cursorOpen = this.findCursor(node.opening);
      if (cursorOpen) return cursorOpen;
      throw new Error('Invalid cursor pair');
    }
    throw new Error('Unknown cursor');
  }

  getCursorClose (cursorOpen: Cursor): Cursor {
    const entry = this.getEntry(cursorOpen);
    if (!entry.status) {
      throw new Error('Must be a opening cursor');
    }
    const node = this._nodeTable.getNodeById(entry.id);
    if (node && node.closing) {
      const cursorClose = this.findCursor(node.closing);
      if (cursorClose) return cursorClose;
      throw new Error('Invalid cursor pair');
    }
    throw new Error('Unknown cursor');
  }

  nextCursor (cursor: Cursor): ?Cursor {
    const leaf = cursor.getLeaf();
    let indexNext = cursor.getIndex() + 1;
    if (leaf.getChildByIndex(indexNext)) {
      return new Cursor(leaf, indexNext);
    } else {
      let leafNext = leaf.getLeafNext();
      while (leafNext) {
        indexNext = 0;
        if (leafNext.getChildByIndex(indexNext)) {
          return new Cursor(leafNext, indexNext);
        }
        leafNext = leafNext.getLeafNext();
      }
    }
    return null;
  }

  prevCursor (cursor: Cursor): ?Cursor {
    const leaf = cursor.getLeaf();
    let indexPrev = cursor.getIndex() - 1;
    if (leaf.getChildByIndex(indexPrev)) {
      return new Cursor(leaf, indexPrev);
    } else {
      let leafPrev = leaf.getLeafPrev();
      while (leafPrev) {
        indexPrev = leafPrev.getChildrenLength() - 1;
        if (leafPrev.getChildByIndex(indexPrev)) {
          return new Cursor(leafPrev, indexPrev);
        }
        leafPrev = leafPrev.getLeafPrev();
      }
    }
    return null;
  }

  nextCursorOpen (cursor: Cursor): ?Cursor {
    const nextCursor = this.nextCursor(cursor);
    if (!nextCursor) return null;
    if (this.getEntry(nextCursor).status) {
      return nextCursor;
    } else {
      return this.nextCursorOpen(nextCursor);
    }
  }

  prevCursorOpen (cursor: Cursor): ?Cursor {
    const prevCursor = this.prevCursor(cursor);
    if (!prevCursor) return null;
    if (this.getEntry(prevCursor).status) {
      return prevCursor;
    } else {
      return this.prevCursorOpen(prevCursor);
    }
  }

  nextCursorClose (cursor: Cursor): ?Cursor {
    const nextCursor = this.nextCursor(cursor);
    if (!nextCursor) return null;
    if (!this.getEntry(nextCursor).status) {
      return nextCursor;
    } else {
      return this.nextCursorClose(nextCursor);
    }
  }

  prevCursorClose (cursor: Cursor): ?Cursor {
    const prevCursor = this.prevCursor(cursor);
    if (!prevCursor) return null;
    if (!this.getEntry(prevCursor).status) {
      return prevCursor;
    } else {
      return this.prevCursorClose(prevCursor);
    }
  }

  nextSiblingCursors (cursor: Cursor): ?[Cursor, Cursor] {
    const entry = this.getEntry(cursor);
    if (entry.status) cursor = this.getCursorClose(cursor);
    const siblingCursor = this.nextCursor(cursor);
    if (!siblingCursor || !this.getEntry(siblingCursor).status) {
      return null;
    }
    return [siblingCursor, this.getCursorClose(siblingCursor)];
  }

  prevSiblingCursors (cursor: Cursor): ?[Cursor, Cursor] {
    const entry = this.getEntry(cursor);
    if (!entry.status) cursor = this.getCursorOpen(cursor);
    const siblingCursor = this.prevCursor(cursor);
    if (!siblingCursor || this.getEntry(siblingCursor).status) {
      return null;
    }
    return [this.getCursorOpen(siblingCursor), siblingCursor];
  }

  insertEntryPairRoot (
    [entryOpen, entryClose]: [OrderEntry, OrderEntry]
  ): [Cursor, Cursor] {
    const leafFirst = this._root.getLeafFirst();
    const leafLast = this._root.getLeafLast();
    const [, leafFirstNew, indexFirst] = leafFirst.insertEntry(entryOpen, 0);
    const [, leafLastNew, indexLast] = leafLast.insertEntry(entryClose, -1);
    return [
      new Cursor(leafFirstNew, keyFirst),
      new Cursor(leafLastNew, keyLast)
    ];
  }

  insertEntryPairChild (
    [entryOpen, entryClose]: [OrderEntry, OrderEntry]
    [parentCursorOpen, parentCursorClose, position]: [Cursor, Cursor, number]
  ): [Cursor, Cursor] {
    let cursorTarget;
    if (position >= 0) {
      cursorTarget = this.nextCursor(parentCursorOpen),
    } else {
      cursorTarget = this.prevCursor(parentCursorClose),
    }
    if (
      cursorTarget === parentCursorClose ||
      cursorTarget === parentCursorOpen
    ) {
      const [, leafOpen, indexOpen] = parentCursorOpen.getLeaf().insertEntry(
        entryOpen,
        parentCursorOpen.getIndex() + 1
      );
      const [, leafClose, indexClose] = leafOpen.insertEntry(
        entryClose,
        indexOpen + 1
      );
      return [new Cursor(leafOpen, indexOpen), new Cursor(leafClose, indexClose)];
    }
    if (position >= 0) {
      while (position > 0) {
        --position;
        const siblingCursors = this.nextSiblingCursors(cursorTarget);
        if (!siblingCursors) break;
        [, cursorTarget] = siblingCursors;
      }
    } else {
      while (position < -1) {
        ++position;
        const siblingCursors = this.prevSiblingCursors(cursorTarget);
        if (!siblingCursors) break;
        [cursorTarget] = siblingCursors;
      }
    }
    return this.insertEntryPairSibling([entryOpen, entryClose], cursorTarget);
  }

  insertEntryPairSibling (
    [entryOpen, entryClose]: [OrderEntry, OrderEntry],
    siblingCursor: Cursor
  ): [Cursor, Cursor] {

    const entry = this.getEntry(siblingCursor);

    if (entry.status) {
      // insert on the left


    } else {
      // insert on the right


    }
  }

  isBeforeCursor (cursor1: Cursor, cursor2: Cursor): boolean {
    const leaf1 = cursor1.getLeaf();
    const leaf2 = cursor2.getLeaf();
    if (leaf1 === leaf2) {
      return cursor1.getIndex() < cursor2.getIndex();
    } else {
      const [lca, child1, child2] = leastCommonAncestor(
        leaf1,
        leaf2,
        (block) => {
          return block.getParent();
        }
      );
      let childIndex1, childIndex2;
      const children = lca.getChildren();
      for (let i = 0; i < children.length; ++i) {
        const child = children[i];
        if (child === child1) {
          childIndex1 = i;
        } else if (child === child2) {
          childIndex2 = i;
        }
        if (childIndex1 != null && childIndex2 != null) {
          break;
        }
      }
      if (childIndex1 == null || !childIndex2 == null) {
        throw new InternalError('leastCommonAncestor returned an ancestor that did not contain the returned children!');
      }
      return childIndex1 < childIndex2;
    }
  }

  adjustLevel (cursor: Cursor) {

  }

  [Symbol.iterator] (): Iterator<Cursor> {
    let leaf = this._root.getFirstLeaf();
    let leafIterator = (leaf) ? leaf[Symbol.iterator]() : null;
    const next = () => {
      if (leaf && leafIterator) {
        const { value } = leafIterator.next();
        if (value) {
          const [index, keyEntry] = value;
          if (keyEntry) {
            return {
              done: false,
              value: new Cursor(leaf, index);
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

export type { Cursor };
