// @flow

import type { CounterTransaction } from 'resource-counter';
import type { OrderEntry, OrderEntryTotal, OrderEntryPartial, OrderIndexI } from '../OrderIndex.js';
import type { NodeId, NodeLevel, NodeTableI } from '../NodeTable.js';

import { CounterImmutable } from 'resource-cunter';
import { Map as MapI } from 'immutable';
import { ArrayFixedDense } from 'array-fixed';
import mkGapLink from '../OrderLinks/GapLink.js';
import {
  interpolationSearch,
  boundIndex,
  generateGapKey,
  generateGapKeys
} from '../utilities.js';

type GapKey = number;

type LinkOpen = {
  leafOpen: Leaf,
  gapKeyOpen: GapKey
};

type LinkClose = {
  leafClose: Leaf,
  gapKeyClose: GapKey
};

type CursorEntry = {
  leaf: Leaf,
  index: number
};


// that is the internal cursor
// it's entry cursor


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
  levelDelta: number;
  children: ArrayFixedDense<[GapKey, OrderEntry], true>;
  updateLinkKey: (NodeId, ?GapKey, ?GapKey) => any;
  parentId: ?TreeId;
  prevId: ?TreeId;
  nextId: ?TreeId;
  constructor (
    id: TreeId,
    levelDelta: number,
    children: ArrayFixedDense<[GapKey, OrderEntry], true>,
    updateLinkKey: (NodeId, ?GapKey, ?GapKey) => any,
    parentId: ?TreeId,
    prevId: ?TreeId,
    nextId: ?TreeId
  ) {
    this.tree = tree;
    this.id = id;
    this.levelDelta = levelDelta;
    this.children = children;
    this.updateLinkKey = updateLinkKey;
    this.parentId = parentId;
    this.prevId = prevId;
    this.nextId = nextId;
  }

  // this is full boolean
  get full (): boolean {
    return this.children.count === this.children.length;
  }

  // this can be done mutably without replacing anything in the tree table or node table
  // it's safe as demonstrated on page 9
  relabelGapKeys () {
    const keys = generateGapKeys(this.children.count);
    let i = 0;
    this.children.forEach((child) => {
      child[0] = keys[i];
      ++i;
      if (child[1].status) {
        this.updateLinkKey(child[1].id, keys[i]);
      } else {
        this.updateLinkKey(child[1].id, null, keys[i]);
      }
    });
  }

  caret (position: number, entry: OrderEntry): GapKey {
    position = boundIndex(position, this.children.length - 1);
    let childPrev, childNext;
    if ((position - 1) >= 0) childPrev = this.children.get(position - 1);
    childNext = this.children.get(position);
    let gapKey;
    if (childPrev && childNext) {
      gapKey = generateGapKey(this.children.length, childPrev[0], childNext[0]);
    } else if (childPrev) {
      gapKey = generateGapKey(this.children.length, childPrev[0]);
    } else if (childNext) {
      gapKey = generateGapKey(this.children.length, null, childNext[0]);
    } else {
      gapKey = generateGapKey(this.children.length);
    }
    if (gapKey == null) {
      this.relabelGapKeys();
      return this.caret(position, entry);
    }




    // so we




    // but if position is 3 and we try to get the 4th element
    // and the length is 4
    // we will get an out of index error
    // so we know we cannot do this!
    // although the normal get doesn't give us an out of index error



    // the children may not exist
    // they may be undefined


    generateGapKey(
      this.children.length

    );




    // the position here represents a careting position
    // which means we cannot allow the usage of numbers greater than the last index
    // this is the ACTUAL index being set
    this.children.caret(position, value);
    return;
  }

  caretI (position: number, value: TreeId): Node {
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
      this.parentId,
      this.prevId,
      idNew
    );
    const childrenRight = this.children.slice(index);
    childrenRight.length = this.children.length;
    const leafRight = new Leaf(
      idNew,
      childrenRight,
      this.levelDelta,
      this.parentId,
      this.id,
      this.nextId
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
      this.parentId,
      this.nextId,
      this.prevId
    );
  }
}

class Node {
  id: TreeId;
  levelDelta: number;
  children: ArrayFixedDense<TreeId, true>;
  parentId: ?TreeId;
  constructor (
    id: TreeId,
    levelDelta: number,
    children: ArrayFixedDense<TreeId, true>,
    parentId: ?TreeId
  ) {
    this.id = id;
    this.children = children;
    this.levelDelta = levelDelta;
    this.parentId = parentId;
  }

  // this is full boolean
  get full (): boolean {
    return this.children.count === this.children.length;
  }

  caret (position: number, value: TreeId): void {
    position = boundIndex(position, this.children.length - 1);
    this.children.caret(position, value);
    return;
  }

  caretI (position: number, value: TreeId): Node {
    position = boundIndex(position, this.children.length - 1);
    const node = new Node(
      this.id,
      this.children.slice(),
      this.levelDelta,
      this.parentId
    );
    node.children.caret(position, value);
    return node;
  }

  // this returns a copy of itself and a new node that is split
  splitI (idNew: TreeId, index?: number): [Node, Node] {
    if (index === undefined) {
      index = this.children.count / 2 ;
    }
    const childrenLeft = this.children.slice(0, index);
    childrenLeft.length = this.children.length;
    const nodeLeft = new Node(
      this.id,
      childrenLeft,
      this.levelDelta,
      this.parentId
    );
    const childrenRight = this.children.slice(index);
    childrenRight.length = this.children.length;
    const leafRight = new Node(
      idNew,
      childrenRight,
      this.levelDelta,
      this.parentId
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

class BOTree implements OrderIndexI<LinkOpen, LinkClose, CursorEntry> {

  _blockSize: number;
  _rootId: TreeId;
  _leftId: TreeId;
  _rightId: TreeId;
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
    // we need an id
    const rootTree = new Leaf(
      id,
      0,
      new ArrayFixedDense(this._blockSize),
      this._updateLinkKey.bind(this)
    );
    this._blockSize = blockSize;
    this._rootId = id;
    this._leftId = id;
    this._rightId = id;
    this._counter = counter;
    this._treeTable = MapI([[id, rootTree]]);
    this._nodeTable = nodeTable;
  }

  // this updates the links mutably
  // because there's no problem doing it
  // it's just for gapkey relabelling

  _updateLink () {

  }

  // updating just key does not need any immutability
  // updating the leaf does require immtuability
  _updateLinkKey (id: NodeId, openKey: ?GapKey, closeKey: ?GapKey) {

  }

  _availableSpace (block: Tree, spaceNeeded: 2) {
    if ((block.children.length - block.children.count) >= spaceNeeded) {
      return true;
    }
    return false;
  }


  // because our parent doesn't change pointing to one
  // we actually alternate
  // when you split, the left one just overwrites the old left one
  // it is the right one you must insert
  // here you may also need to split as well
  // since the current block may be full
  // in which we propagate up the parent and only insert singles
  // not pairs
  // so wait if we have the block, why are we passing nubmers
  // yea cause we may be creating the block
  // in that case just pass blocks

  // we make use of splitting here for insertion

  // function that gives us the gapkey

  // -1 may be returned in this case if it is not found
  // in our case we know that the parent must contain it so it becomes impossible for -1 to be returned

  _findPos (child: Tree, parent: Node): number {
    const childId = child.id;
    return parent.children.findIndex((id) => id === childId);
  }


  _insertIntoLeaf () {

  }

  _insertIntoNode (node, ...pointers) {


    // so can be splicing multiple pointers or what?

  }


  // the right way to insert involves splicing!

  _insertRight (block: Tree, pos: number) {


    // the parent position we want to insert into is always 1 + their index position
    // of the current block in the parent
    const parentPos = this._findPos(block, parentBlock) + 1;

    return this._insertRight(parentBlock, parentPos);

  }

  // they must be of the same type
  // blockLeft and blockRight must be the same type
  // Node and Node
  // or Leaf and Leaf

  _insertLeftRight<tree: Tree> (
    blockLeft: tree,
    posLeft: number,
    blockRight: tree,
    posRight: number
  ) {

    // alright let's do this

    if (blockLeft === blockRight) {

      // note that splicing into leaf is different from splicing into

      if (this._availableSpace(blockLeft, 2)) {

        if (blockLeft instanceof Leaf) {

          // splice Leaf

        } else {

          // splice Node

        }

      } else {

        // perform split
        // and insert into both
        // and then insert right for parent
        // find the parent pos for the left block
        // if parent block is created, we already know what the parent pos is

        if (blockLeft.parentId == null) {
          counter = this._counter.transaction((c) => {
            splitId = c.allocate();
            rootId = c.allocate();
          });
        } else {
          [splitId, counter] = this._counter.allocate();
        }

        // new blockLeft and blockRight

        [blockLeft_, blockRight_] = blockLeft.splitI(splitId);

        // if these are leaf or node they are different
        // wait we don't have to check we can put them both into the classes themselves
        // done!
        // so insertion can be done according to the leaf/node
        // since they have different ways of doing things

        if (blockLeft_ instanceof Leaf) {

        } else {

        }


        const parentPos = this._findPos(blockLeft, parentBlock) + 1;

        return this._insertRight(
          parentBlock,
          parentPos
        );

      }

    } else {

      // this always recalls itself with the parent
      // remember we need a mutable thing until we return!
      // the posLeft changes doesn't it?
      // well it depends on where it is
      // the position depends on where the parent is
      // and also depends on whether we are creating a new parent
      // which we have to do here
      // so it does the right thing
      // also in the case where we are splitting an existing block
      // that blockId stays the same
      // as it is
      // then it is the right side that needs to have that inserted
      // apparently in order to determine the block position in its immediate parent
      // we have to scan linearly
      // since our pointer to the parent doesn't tell us
      // where we are in the parent (unless the parent indexes the ids rather than array of ids)
      // then the ids are also stable, so they then look it up easily?
      // maybe that's what's needed, but that won't work on disk systems
      // this happens only once for each height of the tree until we don't need to split
      // worst case we have to split the entire tree, so that means scan full block for a height of 3 for 1024
      // that's 3 *1024 iterations, which is not that  bad, just comparsions
      // for a million nodes
      // yea it's unordered id numbers that is in an array

      // if the child blocks stored their positions, it means every time you mvoe or split, you have to update them
      // the position doesn't quite make sense anyway

      // what is posLeft given that we don't know where we are
      // well if we split the parent, run through the entire parent anyway (for copy purposes)
      // so we might as well find where we are in the parent
      // so we know where we want to split
      // note that there are 2 situations
      // we split in the middle, then insert appropriately (to make sure we get balanced)
      // or split exactly somewhere

      // ok interleave split and splice together somehow
      // you use the deletion number to take out the part of the array you want

      // children.splice( w);

      // ok so we need to find where we are inserting
      // when we split, the parent doesn't change it's initial id


      return this._insertPair(
        [parentLeftId, posLeft],


      );

    }


    // or just 1 block

    // this inserts a pair
    // and it needs to decide whether we are inserting at 2 blocks or 1 block
    // but it may change
    // the decider is the opening and closing cursor
    // position is always the 2 cursors
    // if they are
    // note that cursors are a bad idea since we are
    // inserting also for parent as well
    // so our cursors have 2 things
    // we have the internal block and the key position
    // index
    // the idea being what we need to insert
    // and we return new entries that are open and close
    // so what is the number we are dealing with?
    // the position number specifically
    // 0 for leftmost
    // -1 for rightmost

    // [_, _, _, _]
    // leftmost 0: [O,_,_,_]
    // rightmost -1: [_,_,_,C]

    // [1,2,3,_]
    // we want to insert between 1 and 2
    // 1 is index 0, 2 is index 2
    // position: 1
    // [1,O,2,3]
    // then we go

    // our position numbering is not the same as the splice
    // where -1 starts at the penultimate
    // -1 really means a shift! from the right
    // we return 2 callbacks

    // and this requires giving back the positions as well
    // since this is what knows where they are
    // note that rebalancing after merge may occur
    // but do we really need to do this?
    // no since this is incremental, no rebalance is required after insertion
    // it's only after deletion or subtree relocation
    // adding new things don't require rebalancing

    if ()


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

    // we are using the leftId and rightId instead
    // and we build up the tree
    // we try to insert on the left
    // and split if necessary
    // we go up to the parent


    let left, right;
    if (this._leftId === this._rightId) {
      const block = this._treeTable.get(this._leftId);
      if (this._spaceAvailable(block ,2)) {
        // we can do this?
      } else {
        // splith the block
        // we need new index
        // we don't know if we are actually creating the root in this case
        // if there's no root we preemptively create the root id in case

        if (block.parentId == null) {
          counter = this._counter.transaction((c) => {
            splitId = c.allocate();
            rootId = c.allocate();
          });
        } else {
          [splitId, counter] = this._counter.allocate();
        }

        [blockLeft, blockRight] = block.splitI(splitId);

        // we need to create new entries

        const entryOpen = {
          id: null,
          status: true
        };

        const entryClose = {
          id: null,
          status: false
        };

        blockLeft.children.splice(0, 0, entryOpen);
        blockRight.children.splice(blockRight.children.count, 0, entryClose);

        // that does it
        // now we need to go up the parent
        // and recurse up
        // this is usually done in a while loop
        // so the parent is not null, we insert
        // actually we just iterate upwards until we find a place we need to split
        // we loop until we don't need to split
        // note how we are doing it for just one block since we are checking this
        // this is where we are splitting

        // if we have a single block we are just doing it here
        // if we have 2 blocks we are just doing it here too
        // but basically we just want to know if we are splitting or not
        // this while loop assumes that before we have 2 blocks
        // the parent is always a single block
        // we also start with the idea that we could be a single block as well

        while (!splitting) {

          // checking whether the parent block needs to be split
          // we always go up the parent
          // so we have an initialisation code
          // it works by running at the beginning just for the current one

          block = this._treeTable.get(block.parentId);
          if (this._spaceAvailable(block, 2)) {
            splitting = false;

            block.children.splice(0, 0, origBlockLeft.id);
            block.children.set(block.children.count, origBlockRight.id);

            // and it's done!

          } else {

            splitting = true;
            // need to perform splitting for the parent
            // get splitId

            [blockLeft, blockRight] = block.splitI(splitId)

            // we need to set the children here
            // unlike entries we are inserting the pointers(
            // we are inserting 2
            // oroginal blocks

            // splice right first, then splice left
            // we can just do this without splicing

            // this is better than splicing then splicing
            // actually splice less cause there's less to move
            // wait these are not the same block so it's fine!

            // if it is the same block, better to splice
            // and then set
            // we are only needing a space available of 1

            blockLeft.children.splice(0, 0, origBlockLeft.id);
            blockRight.children.set(blockRight.children.count, origBlockRight.id);

            // we should really do this across the entire tree
            // so we are not creating unnecessary new things
            // ad in the tree
            // the splitted thing needs to be added in to the tree
            // because we are not changing the old blockLeft
            // it's a new blockLeft
            // it just takes over the old id, since that didn't change

            this._treeTable.withMutations((t) => {
              t.set(blockLeft.id, blockLeft);
              t.set(blockRight.id, blockLeft);
            });

            // so we got this


          }

        }


        if (rootId) {
          const rootChildren = [blockLeft.id, blockRight.id];
          rootChildren.length = this._blockSize;
          root = new Node(
            idRoot,
            ArrayFixedDense.fromArray(rootChildren, 2, true),
            0
          );
          blockLeft.parentId = root.id;
          blockRight.parentId = root.id;
        }



      }




    } else {

      let left = this._treeTable.get(this._leftId);
      let right = this._treeTable.get(this._rightId);



    }

    // if they are the same block, we want to insert 2 on either side
    // if they are different ones, we want to do it simultaneously?
    // you can try each side interleaved
    // until you reach the same block
    // note that since you're balanced, eventually you'll reach the same block
    // at that point you need 2 empty slots
    // if that doesn't exist, you need to split and insert accordingly on either side
    // you actually need to check whether your LCA has a parent
    // and that if it doesn't you create one
    // if it does since you need to split the LCA, you may need to split the parent itself
    // a newly created parent will always have enough space of course for 2 pointers!




    let root = this._treeTable.get(this._rootId);

    // check if the root would have enough space for 2 extra things
    // so we need to know the count and size

    if (root.children.length - root.children.count >= 2) {
      // there is enough space
    } else {

      let splitId, rootId;

      counter = this._counter.transaction((c) => {
        splitId = c.allocate();
        rootId = c.allocate();
      });

      [treeLeft, treeRight] = root.splitI(splitId);
      treeLeft.parentId = rootId;
      treeRight.parentId = rootId;
      ++treeLeft.levelDelta;
      ++treeRight.levelDelta;

      const rootChildren = [treeLeft.id, treeRight.id];
      rootChildren.length = this._blockSize;

      root = new Node(
        idRoot,
        ArrayFixedDense.fromArray(rootChildren, 2, true),
        0
      );

      treeTable = this._treeTable.withMutations((t) => {
        t.set(root.id, root);
        t.set(treeLeft.id, treeLeft);
        t.set(treeRight.id, treeRight);
      });

      // so now we need to add in new things down both sides of the tree
      // until we reach a leaf
      // how do we know we reach a leaf
      // since we are creating things?
      // shouldn't we do this from the first entry and second entry
      // well the idea is that




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

    // the level we always return fot the new entries are
    // -1, -1
    // that always works in this case
    // because we are always adding a level on top
    // and pushing them down

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
