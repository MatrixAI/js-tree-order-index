
import type { OrderEntry, OrderIndexI } from '../OrderIndex.js';

// need to export the type as well from flow types
// otherwise this won't work, figure out how to export the flow types

import { ArrayFixedDense } from 'array-fixed';
import mkGapLink from '../OrderLinks/GapLink.js';
import { interpolationSearch, boundIndex } from '../utilities.js';

// this doesn't achieve stable iteration
// because insertion will result in iterating to the next neighbor which is based on what you already inserted
// to achieve this we need some sort of MVCC or fully persistent B+ tree that is also keyless
// then instead of modifying nodes in place, a copy of the node is made and the required modifications is made to the copy
// the parent of the node is then modified so to point to the new copy, which causes a copy of the parent tobe made and so on
// each time the tree is written, a new root node is created, a snapshot is identified by the root node that it uses
// the problem with this is that each tiem the tree is written to a copy of the node structure modified an all of its ancestor nodes is made, this may prove excessive with large trees!
// reducing this overhead, the data structure should be designed so that it may be edited in place exactly once wihtout existing affecting existing users
// so that means what we do is as we modify the current node, parent must be copied as well
// but is there a way to share the arrays themselves somehow
// only if we use typedarrays
// but we cannot have a typed array sharing some other typed array without some osrt of virtual memory mapping
// consider the difference between an ArrayBuffer and a view
// it would seem to be that
// that if you could extend DataView to operate over multiple ArrayBuffers
// so this would mean you would share each other array
// mutations always create a new thing..
// yea we can do this
// i'm not sure how this will affect the levels, but I think it should work
// split operations also create new things anyway
// but we can have multiple roots
// but how maintains access to the old root
// well cause someone still has a cursor, there's no need to maintain the old root explicitly
// the GC will maintain it until all references are lost
// one problem is by copying the leaf node
// that would mean all entries in the leaf node, all their gap links need to point to the new leaf instead of the old leaf
// since you know which leaf you are in as your iterating (this means objects don't contain pointers to the leaf it is in)
// you have to query the node table and for every row that has a pointer to the leaf, they must change to the new pointer (because there's a new leaf)
// this is because a new iteration would be asking hey can i get node A, then find gaplink of node A, well that will need to start on the new tree root
// because it's a gaplink, it's pointing to some sort of leaf
// if this is pointing at the old leaf
// then it's not capturing the fact that another operation has already inserted a new entry into a leaf, and created a copy of the leaf
// this means during insertions or mutation, you must change all the gaplink pointers in the node table to point to the new leaf
// it means insertion/mutation now has a O(B) cost, similar to scan links or pos links
// we still use gap links however since we don't want to relabel the indexes thesmelves
// but we are now relabelling the the leaf pointers for everybody who uses this leaf
// we also need structure sharing on our node array
// that is each cursor now must maintain a pointer to the relevant node array
// so that the old node array is kept in memory as we traverse
// why is this important, well the new node array shares everything except where all the rows have their leaf pointers (gaplinks) changed
// also what does it mean? it means rather than referring to the node table
// we need to say that the node table allows mutation pointing to old records
// so NodeArray currently is parameterised by link and data
// where the node is Node<link, data>
// what is a Node
// it is an object: { id: number, level: number, opening: link, closing: link }
// and then data
// so isn't this a union, not & data, which asks for intersection
// so each "Node" is an object
// but should it really be, what if we want it to be a class instead
// in that case we really want an interface instead
// and perhaps with computed properties!
// yes a type also works with objects
// so it's probably better to say it is just a type then
// ok so this is already possible, then we just need to be able to mutate the array while changing the structure

// nodearray.set(), returns a new node array
// the old nodearray hasn't changed
// we replace the main nodearray representation in the main OrderIndexTree
// so that new iterators refer to that
// but how do we do this
// the set operation would need to be covered...
// also when we call nodearray, we are calling it from the BOTree here
// upon insertion of new order entry pair, we need to create a new leaf
// we then call nodearray.setWhere(gaplink = leaf, leaf = newLeaf)
// but this gives us a new node array
// how do we make sure that this new node array is set back to the main tree

type Cursor = OrderEntry | {
  key: number;
  leaf: Leaf;
};

type Tree = Leaf | Node;

class Leaf {
  children: ArrayFixedDense<Entry>;
  levelDelta: number;
  parentNode: ?Node;
  leafNext: ?Leaf;
  leafPrev: ?Leaf;
  constructor (
    children: ArrayFixedDense<Entry>,
    levelDelta: number,
    parentNode: ?Node,
    leafNext: ?Leaf,
    leafPrev: ?Leaf
  ) {
    this.children = children;
    this.levelDelta = levelDelta;
    this.parentNode = parentNode;
    this.leafNext = leafNext;
    this.leafPrev = leafPrev;
    Object.seal(this);
  }
}

class Node {
  children: ArrayFixedDense<Tree>;
  levelDelta: number;
  parentNode: ?Node;
  constructor (
    children: ArrayFixedDense<Tree>,
    levelDelta: number,
    parentNode: ?Node
  ) {
    this.children = children;
    this.levelDelta = levelDelta;
    this.parentNode = parentNode;
    Object.seal(this);
  }
}

// we don't iterate using cursors anymore
// instead we use entries now directly
// since we need to be able to make sure each entry is still
// valid as we mutate it
/* class Cursor {
 *   leaf: Leaf;
 *   index: number;
 *   constructor (leaf: Leaf, index: number) {
 *     this.leaf = block;
 *     this.index = index;
 *     Object.freeze(this);
 *   }
 * }*/


// the Entry extension is the Cursor type
// that we are returning, this is going to be great!
// because this encapsulates, we need to pass on the data
// sure we don't get to care about the data
// but what does it really mean
// we're saying that a node table must have some data that is passed in

// Cursor is an exported opaque type, so that users know what is being returned here
// but when using this they have to then say they work with any cursor, that being of OrderIndexI<any>
// but really this <any> shouldn't even be used
// maybe if we use a type alias like type OrderIndexI = OrderIndexI_<any>;
// and export that
// but classes now implement with any, while users need to refer to OrderIndexI...? so strange!

class BOTree implements OrderIndexI<GapLink<Leaf>, *, Cursor> {

  _nodeTable: NodeTableI<GapLink<Leaf>, *>;
  _blockSize: number;
  _root: Tree;

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
    this._root = new Leaf(new ArrayFixedDense(this._blockSize), 0);
  }

  getNodeTable (): NodeTableI<GapLink<Leaf>, *> {

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
