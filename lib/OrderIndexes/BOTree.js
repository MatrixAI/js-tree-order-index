// @flow

import type { CounterTransaction } from 'resource-counter';
import type { OrderEntry, OrderIndexI } from '../OrderIndex.js';
import type { NodeId, NodeLevel, NodeTableI } from '../NodeTable.js';

import { CounterImmutable } from 'resource-cunter';
import { Map as MapI } from 'immutable';
import { ArrayFixedDense } from 'array-fixed';
import mkGapLink from '../OrderLinks/GapLink.js';
import { interpolationSearch, boundIndex } from '../utilities.js';

type LinkOpen = {
  leafOpen: Leaf,
  gapKeyOpen: number
};

type LinkClose = {
  leafClose: Leaf,
  gapKeyClose: number
};

type Cursor = {
  leaf: Leaf,
  index: number
};

// we now need a block table
// tree table to be precise since we don't actually have a tree
// we have a graph
// and our BOTree table is acutally a graph
// we need a table to manage the indirection
// this is one way of implementing a fully persistent graph
// to do this properly, we need have an id for each node
// and this is a Map<> right?
// or we can use a table?
// so we are storing Trees, this means Leaf and Node
// so in the case of an id, we are saying that his will give us a parent

type TreeId = number;

type TreeTable = MapI<TreeId, Tree>;

type Tree = Leaf | Node;

class Leaf {
  id: TreeId;
  children: ArrayFixedDense<OrderEntry>;
  levelDelta: number;
  parent: ?TreeId;
  next: ?TreeId;
  prev: ?TreeId;
  constructor (
    id: TreeId,
    children: ArrayFixedDense<OrderEntry>,
    levelDelta: number,
    parent: ?TreeId,
    next: ?TreeId,
    prev: ?TreeId
  ) {
    this.id = id;
    this.children = children;
    this.levelDelta = levelDelta;
    this.parent = parent;
    this.next = leaf;
    this.prev = prev;
  }

  // splits immutably, but reuses the current id for the left split
  splitI (idNew: TreeId, index?: number): [Leaf, Leaf] {
    if (index === undefined) {
      index = this.children.count / 2 ;
    }
    const childrenLeft = this.children.slice(0, index);
    childrenLeft.length = this.children.length;
    const leafLeft = new Leaf(
      this.id,
      childrenLeft,
      this.levelDelta,
      this.parent,
      idNew,
      this.prev
    );
    const childrenRight = this.children.slice(index);
    childrenRight.length = this.children.length;
    const leafRight = new Leaf(
      idNew,
      childrenRight,
      this.levelDelta,
      this.parent,
      this.next,
      this.id
    );
    return [
      leafLeft,
      leafRight
    ];
  }

  copyDeep () {
    return new Leaf(
      this.children.slice(),
      this.levelDelta,
      this.parent,
      this.next,
      this.prev
    );
  }
}

class Node {
  id: TreeId;
  children: ArrayFixedDense<Tree>;
  levelDelta: number;
  parent: ?TreeId;
  constructor (
    id: TreeId,
    children: ArrayFixedDense<Tree>,
    levelDelta: number,
    parent: ?TreeId
  ) {
    this.id = id;
    this.children = children;
    this.levelDelta = levelDelta;
    this.parent = parent;
  }
  splitI (idNew: TreeId, index?: number): [Leaf, Leaf] {
    if (index === undefined) {
      index = this.children.count / 2 ;
    }
    const childrenLeft = this.children.slice(0, index);
    childrenLeft.length = this.children.length;
    const leafLeft = new Node(
      this.id,
      childrenLeft,
      this.levelDelta,
      this.parent,
      idNew,
      this.prev
    );
    const childrenRight = this.children.slice(index);
    childrenRight.length = this.children.length;
    const leafRight = new Node(
      idNew,
      childrenRight,
      this.levelDelta,
      this.parent,
      this.next,
      this.id
    );
    return [
      leafLeft,
      leafRight
    ];
  }
  copyDeep () {
    return new Node(
      this.children.slice(),
      this.levelDelta
    );
  }
}

// in order to create a fully persistent BOTree
// we need to realise that BOTree is not strictly a tree
// but a graph
// the easiest way to make a fully persistent graph
// is to use a fully persistent table backed by a tree itself
// in this case Immutable MapI
// evey Tree node must have a unique id
// and all pointers between between tree nodes is indirect
// via a jump into the table itself
// to create an immutable table, you can't really use a hashtable
// you have to use a tree itself
// now this does make the whole thing a bit slower
// but the tradeoff is you get immutability!
// so now we can also just keep a reference to the table
// for any table modifications
// and all the ids will just update

class BOTree implements OrderIndexI<LinkOpen, LinkClose, Cursor> {

  _blockSize: number;
  _root: TreeId;
  _counter: CounterImmutable;
  _treeTable: TreeTable;
  _nodeTable: NodeTableI<LinkOpen, LinkClose, *>;

  constructor (
    blockSize: number = 64,
    nodeTable: NodeTableI<LinkOpen, LinkClose, *>,
  ) {
    if (blockSize <= 4 || blockSize % 2 !== 0) {
      throw new RangeError(
        'blockSize must be at least 4 and an even length for splitting and splicing'
      );
    }
    const [id, counter]= (new CounterImmutable).allocate();
    const rootTree = new Leaf(new ArrayFixedDense(this._blockSize), 0);
    this._blockSize = blockSize;
    this._root = id;
    this._counter = counter;
    this._treeTable = MapI([[id, rootTree]]);
    this._nodeTable = nodeTable;
  }

  insertRoot (): [
    [
      LinkOpen,
      LinkClose,
      NodeLevel,
      (NodeId) => void
    ],
    OrderIndexI<LinkOpen, LinkClose, Cursor>
  ] {

    // so this creates a new root
    // this is what figures out
    // what the new level of the root should be
    // that's why it returns it
    // it also returns links to it

    // root entries start on the far left and far right
    // they are within their own blocks
    // they always start with level -1 in the nodetable
    // we build out blocks on the left side and right side
    // and we want to insert these new sides to the root block
    // if there is space for 2 pointers, +1 to the level of the root block
    // if there is no space for the 2 pointers, split the root block
    // create a new root, and with +1 to its level
    // and it is done!

    // ok so 2 ways to do this, go from root and grow downwards
    // remember we start a transaction to do this
    // and we always create a new root
    // and we return the new BOTree

    // if we go from root, how do we know when to stop?
    // that's an issue
    // we would need to know the height of the tree
    // traversing down and traversing up as we build it
    // since we are building new Nodes, which has a child pointer pointing downwards
    // and

    const root = this._treeTable.get(this._root);

    // check if the root would have enough space for 2 extra things
    // so we need to know the count and size

    if (root.children.length - root.children.count >= 2) {
      // there is enough space
    } else {

      // there is not enough space
      // we need to split and create a new root
      // we can always split evenly
      // try to interleave the splice, we need to slice
      // well we are deleting it
      // and we are returning a new array fixed desnse
      // actually first we are coying
      // cause we don't actually have this
      // so we need to remember to slice it all to make sure to copy it properly
      // what do we say it is
      // it's a copy of the current one
      // but if the root is a leaf
      // we need to copy the leaf, to get 2 leafs
      // cause we want to copy it
      // or we can embed the copy function so that way I don't need to check it
      // yea that would be better...

      // when we copy, we are just slicing a new version of the old one
      // so when we fill it up again?
      // we need to create children with the necessary slice
      // half and half
      // so maybe we should split instead?

      const rootNew = root.copyDeep;

    }

    const leftChild = root.children.get(0)

    // traverse down and create blocks on the right
    // we need to point them downwards and upwards
    // and create a new root

    while (!(leftChild instanceof Leaf)) {

    }
    // how do we know whether it is Root Or Node?
    // oh shit
    // we need a marker for this
    if (leftChild instanceof Leaf) {
      // full stop
    } else {
      // then we need to do something else
    }


    // note that he 0 may be >0 to thelength
    // so this may be out of bounds
    // how do we get the first
    // but we know that the children are arrayfixeddense of a length greater than 3
    // so we know that 0 then should be undefined
    // can we define this recursively or should we use a while loop?
    // because this is pure data, we need to use a while loop

    // get to the first child note that if
    // we know this is deense arra

  }


  findCursor (link: GapLink<Leaf>): ?Cursor {
    const children = link.block.children;
    const [index, cost] = interpolationSearch(
      link.key,
      children.count,
      (index) => children.get(index)[0];
    );
    if (cost > Math.log2(children.count)) {
      this._relabelGapKeys();
    }
    if (index != null) {
      return new Cursor(link.block, index);
    }
    return null;
  }

  // cursors are neither valid over mutations while iterating
  // nor are they stable iterations
  // this could be solved if each entry has a pointer to the block it is in
  // but this seems rather cyclic
  // does it make sense to create cyclic data structures
  // especially with things like LCA algorithm
  // why not have each entry point back to the block it is in
  // this allows you to make sure that "entry" cursor is stable

  getLink (cursor: Cursor): GapLink {

    const children = cursor.leaf.children;
    const child = children.get(cursor.index);
    if (child) return new GapLink(cursor.leaf, child[0]);
    throw new Error('Invalid cursor');

    // we assume this exists right!?
    // or is it that the cursor could become out of date
    // yes if you hold a cursor, and then make things that change that
    // that cursor is no longer valid
    // iteration over a cursor can make other cursors invalid
    // note usually you solve this using a sort of MVCC
    // so that iteration is stable
    // that cursors are always referencing a particular snapshot of data
    // that would require us to make this tree purely functional in a way
    // so that iteration is stable
  }

  getEntry (cursor: Cursor): OrderEntry {
    const child = cursor.getLeaf().getChildByIndex(cursor.getIndex());
    if (child) return child.entry;
    throw new Error('Invalid cursor');
  }

  // oh this does need reference to the node table lol
  // ok...

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


  // who does the update and relabelling of the gapkeys work?
  // consider that the node table is being passed into each leaf
  // this is pretty dumb
  // it should be the botree that is doing that
  // but if the leaf is the one doing the insertion
  // only it knows about the fact that the data needs to be relabelled
  // unless we expose that each leaf is just an POJO
  // then the insertEntry is where we define this functionality
  // it'd be part of a private method
  // there's 2 parts to this
  // WHO UPDATES THE NODE TABLE to update the link after entry
  // and WHO UPDATES THE NODE TABLE for relabelling
  // the ideal is for the BOTree itself to have a nodetable link
  // and perform the update link and relabelling procedure itself
  // but then we what we are saying is that the function for insertion into a leaf is performed here and not in the leaf itself
  // maybe that's what we need to do, thus making a leaf a sort of POJO
  // this means we have insertEntry (orderEntry, leaf, position)
  // note that position is translated from the cursor
  // but why not instead _insertEntry(orderEntry, cursor)
  // because this is a low level function that is just the leaf and position number
  // anyway that means we can shift out the notion of updating link and relabelling here
  // instead
  // and also we need to access the data directly

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

  _insertEntry (orderEntry: OrderEntry, leaf: Leaf, position: number) {


  }

  // here we are saying is that we perform the updating of links here directly
  _relabelGapKeys () {

  }

  _updateLink (id: number) {

  }

  // instead of having classes like this, we should have just used plain data structures then
  // leaf: { ..., ..., ...}
  // type tree = leaf | node;
  // ok that's what we are doing, we are changing to that...
  // we are going to get change to plain data structures, as this is becoming difficult to implement cleanly
  // define what properties i'm dealing with cleanly please!!
  // we need them to be POJOs rather than classes


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
