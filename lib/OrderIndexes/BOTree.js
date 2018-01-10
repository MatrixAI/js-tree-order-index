// @flow

import type { OrderIndexI, OrderCursorI, OrderEntry } from '../OrderIndex.js';

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

  // this is a standard iterator
  // but we really want a proper cursor
  // we can use the Baobab library to provide this
  // we return back a cursor based on some position
  // without a given index, we just return the normal cursor
  [Symbol.iterator] (): Iterator<child> {
    return this._children.entries();
  }

  getParent (): ?Node {
    return this._parentNode;
  }

  getChildren (): Array<children> {
    return this._children;
  }

  getChildByIndex (index: number): ?child {
    return this._children[index];
  }

}

class Leaf extends Block<{key: number, entry: OrderEntry}> {

  _gapSize: number;
  _nextLeaf: ?Leaf;
  _prevLeaf: ?Leaf;
  _updateLink: (number, ?GapLink<Leaf>, ?GapLink<Leaf>) => any;

  constructor (
    blockSize: number,
    levelDelta: number = 0,
    parentNode: ?Node,
    children: ?Array<{key: number, entry: OrderEntry}>,
    updateLink: (number, ?GapLink<Leaf>, ?GapLink<Leaf>) => any,
    nextLeaf: Leaf = null,
    prevLeaf: Leaf = null
  ) {
    super(blockSize, levelDelta, parentNode, children);
    this._gapSize = Math.floor(Number.MAX_SAFE_INTEGER / blockSize);
    this._nextLeaf = nextLeaf;
    this._prevLeaf = prevLeaf;
  }

  getFirstLeaf (): Leaf {
    return this;
  }

  getLastLeaf (): Leaf {
    return this;
  }

  getNextLeaf (): ?Leaf {
    return this._nextLeaf;
  }

  setNextLeaf (nextLeaf: Leaf) {
    this._nextLeaf = nextLeaf;
    return;
  }

  getPrevLeaf (): ?Leaf {
    return this._prevLeaf;
  }

  setPrevLeaf (prevLeaf: Leaf) {
    this._prevLeaf = prevLeaf;
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

  insertEntry (position: number, orderEntry: OrderEntry): void {

    // then we just insert at the beginning!
    if (!this._lastIndex) {

    } else {
      // do other things
    }



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
      // so we do that, and then what happens?

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

class BOTree implements OrderIndexI<GapLink<Leaf>, Cursor> {

  _blockSize: number;
  _root: Leaf | Node;

  constructor (
    blockSize: number = 64,
    updateLink: (number, ?GapLink<Leaf>, ?GapLink<Leaf>) => any
  ) {
    if (blockSize % 2 !== 0) {
      throw new RangeError('blockSize must be even for even splitting');
    }
    if (blockSize < 2) {
      throw new RangeError('blockSize must be greater than 2 for splitting');
    }
    this._blockSize = blockSize;
    this._root = new Leaf(blockSize, updateLink);
  }

  findCursor (link: GapLink<Leaf>): ?Cursor {
    const leaf = link.getBlock();
    const child = leaf.getChildByKey(leaf.getGapKey());
    if (child) return new Cursor(leaf, child[0]);
    return null;
  }

  getEntry (cursor: Cursor): ?OrderEntry {
    const child = cursor.getLeaf().getChildByIndex(cursor.getIndex());
    if (child) return child.entry;
    return null;
  }

  getLink (cursor: Cursor): ?GapLink {
    const child = cursor.getLeaf().getChildByIndex(cursor.getIndex());
    if (child) return new GapLink(cursor.getLeaf(), child.key);
    return null;
  }

  nextCursor (cursor: Cursor): ?Cursor {
    const leaf = cursor.getLeaf();
    const nextIndex = cursor.getIndex() + 1;
    if (leaf.getChildByIndex(nextIndex)) {
      return new Cursor(leaf, nextIndex);
    } else {
      const nextLeaf = leaf.getNextLeaf();
      if (nextLeaf && nextLeaf.getChildByIndex(0)) {
        return new Cursor(nextLeaf, 0);
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

  nextCursorClose (cursor: Cursor): ?Cursor {
    const nextCursor = this.nextCursor(cursor);
    if (!nextCursor) return null;
    if (!this.getEntry(nextCursor).status) {
      return nextCursor;
    } else {
      return this.nextCursorClose(nextCursor);
    }
  }

  isBefore (cursor1: Cursor, cursor2: Cursor): boolean {
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

  insertEntryPair (
    [openEntry, closeEntry]: [OrderEntry, OrderEntry]
    linkPosition: ?[GapLink<Leaf>, GapLink<Leaf>, number]
  ): [GapLink<Leaf>, GapLink<Leaf>] {
    if (openEntry.id !== closeEntry) {
      throw new Error('Entry pair must have the same id.');
    }
    if (!openEntry.status && closeEntry.status) {
      throw new Error('Entry pair has invalid statuses.');
    }
    if (!linkPosition) {
      this._root.getFirstLeaf();
      this._root.getLastLeaf();
      // insert on the left side and right side
    } else {
      const [parentOpenLink, parentCloseLink, position] = linkPosition;
      if (position >= 0) {
        // start on the opening link and traverse to the correct position
      } else {
        // start on the closing link and traverse to the correct position
      }
    }
  }

  [Symbol.iterator] (): Iterator<GapLink<Leaf>> {
    let leaf = this._root.getFirstLeaf();
    let leafIterator = (leaf) ? leaf[Symbol.iterator]() : null;
    const next = () => {
      if (leaf && leafIterator) {
        const { value: child } = leafIterator.next();
        if (child) {
          const [gapKey,] = child;
          if (gapKey) {
            return {
              done: false,
              value: new GapLink(leaf, gapKey);
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
