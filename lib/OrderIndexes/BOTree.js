// @flow

import type { OrderIndexI, OrderCursorI, OrderEntry } from '../OrderIndex.js';

import GapLink from '../OrderLinks/GapLink.js';
import { interpolationSearch, boundIndex } from '../utilities.js';

// this cursor -> index, gapkey, order entry
// a GapLink is LEAF + GAPKEY
// a Cursor is LEAF + INDEX
// that's what this is all about
// funny
class Cursor implements OrderCursorI {
  _leaf: Leaf;
  _index: number;
  constructor (leaf, index) {
    this._leaf = leaf;
    this._index = index;
  }
  next () {
    ++this._index;
    // traverse the index
    // and optionally traverse the leaf
    // return back the result
    // oh can we even go backwards actaully since we can't actually
    // have backlinks to the previous leaf
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

  getByIndex (index: number): ?child {
    return this._children[index];
  }

  getCursor (): Cursor {
    // instead of using baobab, we return an object
    // that allows an interface
    // like: { next, prev }
    // so each time the cursor calls next we get the thing
    // similar to Iterator
    // in that next both mutates the current iterator
    // and returns the results
    // in fact we operate in the same way
    // but we add a prev call
    // we also allow you to create a cursor at any point
    // that's the key point
    return (new Baobab(this._children)).root;
  }

}

class Leaf extends Block<{key: number, entry: OrderEntry}> {

  _gapSize: number;
  _nextLeaf: ?Leaf;
  _updateLink: (number, ?GapLink<Leaf>, ?GapLink<Leaf>) => any;

  constructor (
    blockSize: number,
    levelDelta: number = 0,
    parentNode: ?Node,
    children: ?Array<{key: number, entry: OrderEntry}>,
    updateLink: (number, ?GapLink<Leaf>, ?GapLink<Leaf>) => any,
    nextLeaf: Leaf = null
  ) {
    super(blockSize, levelDelta, parentNode, children);
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

  getByKey (key: number): ?[number, OrderEntry] {
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

  // so we return the gap link to this entry
  // and we don't bother synchronising it
  // and orderEntry has a node ID and status boolean
  // that's all
  // when we insert into the order entry
  // it is the BOTree that returns the GapLink to this entry
  // it will need to know which block it installs it into
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

class BOTree implements OrderIndexI<GapLink<Leaf>> {

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

  /* findEntry (link: GapLink<Leaf>): ?OrderEntry {
   *   return link.getBlock().getEntryByKey(link.getGapKey());
   * }*/

  // this is what you want
  // index -> cursor
  // gapKey -> cursor
  // cursor -> index, gapkey, entry

  getCursor (link: GapLink<Leaf>): Cursor {

  }

  isBefore (cursor, cursor) {

  }



  // next(e) is part of Cursor
  // next_pre is part of Cursor as well
  // next_post is part of Cursor as well
  // OR cursor can be a dumb container, and these functions deal with it
  nextLink (link: GapLink<Leaf>): ?GapLink<Leaf> {
    let leaf = link.getBlock();
    let gapKey = link.getGapKey();

    // the problem with doing this is that iterating over to the next gap link involves alot of work
    // it requires getting by gap key
    // and each time you want to iterate you're going to have to search for the gap key
    // this seems kind of dumb
    // what you want instead is to have a separate type
    // called a cursor type
    // this cursor
    // that's internal to this data structure that allows you to keep track of the leaf block that it is in, the index that it found and the gap key
    // actually you want the index and the block
    // that's all...

    let indexAndEntry = leaf.getByKey(gapKey);
    if (indexAndEntry) {
      const indexAndEntry = leaf.getByIndex(indexAndEntry[0] + 1);
      if (indexAndEntry) {
        return new GapLink(leaf, indexAndEntry.getGapKey());
      } else {
        leaf = leaf.getNextLeaf();


      }
    }

    return null;


    // then we iterate over the index
    // if the iteration finishes
    // we try the next leaf
    // if that's null then it truly is null


    // wait we need to first check if this exists
    // this is actually an error
    // we need to do the interpolation search first
    // and we need to get the index

    const entry = leaf.getEntryByKey(gapKey);

    if (!entry) {
      throw new RangeError('link is not valid within this tree');
    }

    // so we want to find the NEXT link
    // this requires knowing about the index
    // not just the order entry
    // so we can +1 to the index and get the actual property

  }


  // insertion into a BOTree returns back a GapLink to that entry
  insertEntry (
    entry: OrderEntry,
    parentLinks: [GapLink<Leaf>, GapLink<Leaf>],
    position: number
  ): GapLink<Leaf> {

    // position should refer to things like children
    // so we must only iterate based on children
    // position can then be things like 1, -1... etc
    // -1 refers to the right most position
    // so we want to iterate to the end
    // wait don't we need both gaplinks
    // so we know opening and closing?
    // hmm there's no easy way to find all the children
    // except to iterate over them all
    // that is, you just have to get ALL entries UNTIL you reach your closing entry
    // everything in between is your children
    // so if you want to go -1
    // then it's FASTER if you have your closing link, and we can reverse iterate
    // at any case, if you have your parent node you have the opneing and closing
    // the parent node has both opening and closing links
    // so it should be easy enough
    // this makes it similar to a doubly linked list
    // how to efficiently insert a leaf into the middle of a set of children?
    // like imagine a BIG breadth of children
    // you'd need to iterate over the children until you're there
    // no easy way to do that



    // we need to understand how the insertion occurs accordiung to a position
    // consider that the position attribute here depends on a number of properties
    // this is about both the leaf positions and everything else
    // we need to also remember to get Leaf
    // insertion for a tree like this is always based on 2 things
    // original node position
    // and subnode insertion
    // when you insert
    // so that means we are a BOTree
    // you have some relationship already to the node that you want insert into
    // note that he tree insertion corresponids to leaf insertion
    // so we need to know which leaf we are talking about


    // sibling iteration is like this
    // get the closing entry
    // get the next entry
    // check if this entry is a opening
    // if yes, that's a sibling
    // if not, then this has no more siblings

  }

  isOpening (entry: OrderEntry): boolean {
    return entry.opening;
  }

  isBefore (entry1: OrderEntry<id>, entry2: OrderEntry<id>): boolean {
    // check the numbers in between
    // remember we are doing traversal over a B+tree
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
