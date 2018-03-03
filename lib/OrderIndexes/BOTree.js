// @flow

import type { CounterTransaction } from 'resource-counter';
import type { OrderEntry, OrderEntryTotal, OrderEntryPartial, OrderIndexI } from '../OrderIndex.js';
import type {
  NodeId,
  NodeLevel,
  NodeTableI,
  NodeTableTransaction
} from '../NodeTable.js';

import { CounterImmutable } from 'resource-cunter';
import { Map as MapI } from 'immutable';
import { ArrayFixedDense } from 'array-fixed';
import mkGapLink from '../OrderLinks/GapLink.js';
import {
  interpolationSearch,
  boundIndex,
  generateGapKey,
  generateGapKeys,
  nestContexts
} from '../utilities.js';

type GapKey = number;

// now leafOpen and leafClose are not leaf objects
// but tree ids
// can refer to leafs
// although it's not guaranteed anymore
// since we are saying that it's a tree id
// how can we statically guarantee this?
// we cannot
// all we can do is check and throw exceptions if they are not
// it becomes dynamic then

type LinkOpen = {
  leafOpen: TreeId,
  gapKeyOpen: GapKey
};

type LinkClose = {
  leafClose: TreeId,
  gapKeyClose: GapKey
};

type CursorEntry = {
  leaf: Leaf,
  index: number
};

type SnapShot = WeakSet<Leaf|Node>;

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
  updateLink: (NodeId, ?LinkOpen, ?LinkClose) => any;
  parentId: ?TreeId;
  prevId: ?TreeId;
  nextId: ?TreeId;
  constructor (
    id: TreeId,
    levelDelta: number,
    children: ArrayFixedDense<[GapKey, OrderEntry], true>,
    updateLink: (NodeId, ?LinkOpen, ?LinkClose) => any,
    parentId: ?TreeId,
    prevId: ?TreeId,
    nextId: ?TreeId
  ) {
    this.tree = tree;
    this.id = id;
    this.levelDelta = levelDelta;
    this.children = children;
    this.updateLink = updateLink;
    this.parentId = parentId;
    this.prevId = prevId;
    this.nextId = nextId;
  }

  get space () {
    return this.children.length - this.children.count;
  }

  // position must be a number within
  // really it's an index
  // a non-relevant index will throw an error
  _generateGapKey (index: number) {
    childNext = this.children.get(index);
    if ((index - 1) >= 0) childPrev = this.children.get(index - 1);
    if (this.children.count) childLast = this.children.get(this.children.count - 1);
    let gapKey;
    if (childPrev && childNext) {
      gapKey = generateGapKey(this.children.length, childPrev[0], childNext[0]);
    } else if (childPrev) {
      gapKey = generateGapKey(this.children.length, childPrev[0]);
    } else if (childNext) {
      gapKey = generateGapKey(this.children.length, null, childNext[0]);
    } else {
      gapKey = generateGapKey(this.children.length, childLast[0]);
    }
    return gapKey;
  }

  relabelGapKeys (
    ignoredIndices: Set<number>
  ) {
    const keys = generateGapKeys(this.children.count);
    let i = 0;
    this.children.forEach((child, index) => {
      child[0] = keys[i];
      ++i;
      // only update the links for non-ignored indices
      if (!ignoredIndices.has(index)) {
        if (child[1].status) {
          this.updateLink(
            child[1].id,
            {
              leafOpen: this.id,
              gapKeyOpen: keys[i]
            }
          );
        } else {
          this.updateLink(
            child[1].id,
            null,
            {
              leafClose: this.id,
              gapKeyClose: keys[i]
            }
          );
        }
      }
    });
  }

  caretPair (
    position1: number,
    entry1: OrderEntry,
    position2: number,
    entry2: OrderEntry
  ) {
    // bound the position to valid indices
    position1 = boundIndex(position1, this.children.length - 1);
    position2 = boundIndex(position2, this.children.length - 1);

    // if you insert a pair where both are right of position
    // like -2, -1
    if (position1 === position2) {
      throw new Error();
    }

    // swap positions so that position1 is always less or equal to position2
    if (position2 < position1) {
      [position1, position2] = [position2, position1];
      [entry1, entry2] = [entry2, entry1];
    }

    // perform the caret
    // by position1 and then position2
    // note that the gapkey inserted may be wrong
    // we mark this, and proceed with gapkey relabelling if necessary
    // however gapkey relabellling cannot be performed on these new keys
    // we have to mark it to be ignored
    // how do we do this?
    // we can say that the gapkey is actually missing?
    // but that's only intermediate
    // so...?
    // we just pass some ignored indices into the function
    // that's it
    // so we can give it a dummy gapkey
    // like 0
    // and just relabel it

    let needsRelabelling = false;

    // this will be true IF
    // one of the genereateKey is wrogn







    let gapKey1;
    gapKey1 = this._generateGapKey(position1);

    if (gapKey1 == null) {
      needsRelabelling = true;
      gapKey1 = 0;
    }
    // caret it in
    // remember position1 as something to be changed
    // we know position1 is less or equal
    // so if position1 is less, that's fine
    // but if equal
    // actually let's just throw an error
    this.children.caretRight(position1, [gapKey1, entry1]);

    let gapKey2;
    gapKey2 = this._generateGapKey(position2);
    if (gapKey2 == null) {
      needsRelabelling = true;
      gapKey2 = 0;
    }
    this.children.caretRight(position2, [gapKey2, entry2]);

    // we just try to caret




    // we can have a function that does it twice
    // this.generateGapKey(position1);
    // this.generateGapKey(position2);
    // we must insert AND then perform generateGapKey

    if (gapKey == null) {
      needRelabelling = true;
    }


    // how do we know?
    const ignoredIndices = new Set([position1, position2]);


    // wait..
    // if we relabel gap keys
    // then we need to recall the function with the same position
    // MAYBE...
    // we try to get one or the other
    // if we cannot get both gapkeys
    // then we relabel?
    // or...
    // what we do is insert but relabel


    if (gapKey == null) {
      this.relabelGapKeys();
      return this.caretPair(position, entry);
    }




    // 2 positions so we just need to caret twice
    // but if there is not enough space
    // then that is a problem
    // so we need to make sure we have enough space to caret into
    // before hand

  }

  // only call this if this place is not full
  caret (position: number, entry: OrderEntry): [number, GapKey] {
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
    this.children.caretRight(position, [gapKey, entry]);
    return [position, gapKey];
  }

  caretI (position: number, entry: OrderEntry): [[number, GapKey], Leaf] {
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
      return this.caretI(position, entry);
    }
    const leaf = new Leaf(
      this.id,
      this.children.slice(),
      this.levelDelta,
      this.parentId,
      this.prevId,
      this.nextId
    );
    leaf.children.caretRight(position, [gapKey, entry]);
    return [
      [position, gapKey],
      leaf
    ];
  }

  split (idNew: TreeId, index?: number): [Leaf, Leaf] {
    if (index === undefined) {
      index = this.children.count / 2 ;
    }
    const childrenLeft = this.children.slice(0, index);
    const childrenRight = this.children.slice(index);
    childrenLeft.length = this.children.length;
    childrenRight.length = this.children.length;
    this.children = childrenLeft;
    this.nextId = idNew;
    leafLeft = this;
    const leafRight = new Leaf(
      idNew,
      childrenRight,
      this.levelDelta,
      this.parentId,
      this.id,
      this.nextId
    );
    // this updates the links automatically
    leafRight.relabelGapKeys();
    return [
      leafLeft,
      leafRight
    ];
  }

  splitI (idNew: TreeId, index?: number): [Leaf, Leaf] {
    if (index === undefined) {
      index = this.children.count / 2 ;
    }
    const childrenLeft = this.children.slice(0, index);
    const childrenRight = this.children.slice(index);
    childrenLeft.length = this.children.length;
    childrenRight.length = this.children.length;
    const leafLeft = new Leaf(
      this.id,
      childrenLeft,
      this.levelDelta,
      this.parentId,
      this.prevId,
      idNew
    );
    const leafRight = new Leaf(
      idNew,
      childrenRight,
      this.levelDelta,
      this.parentId,
      this.id,
      this.nextId
    );
    // this updates the links automatically
    leafRight.relabelGapKeys();
    return [
      leafLeft,
      leafRight
    ];
  }

  clone () {
    return new Leaf(
      this.id,
      this.levelDelta,
      this.children.slice(),
      this.updateLink,
      this.parentId,
      this.prevId,
      this.nextId
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

  caret (position: number, value: TreeId): number {
    position = boundIndex(position, this.children.length - 1);
    this.children.caretRight(position, value);
    return position;
  }

  caretI (position: number, value: TreeId): [number, Node] {
    position = boundIndex(position, this.children.length - 1);
    const node = new Node(
      this.id,
      this.children.slice(),
      this.levelDelta,
      this.parentId
    );
    node.children.caret(position, value);
    return [position, node];
  }

  // this is a mutable split
  split (idNew: TreeId, index?: nubmer): [Node, Node] {

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

  clone () {
    return new Node(
      this.id,
      this.levelDelta,
      this.children.slice(),
      this.parentId
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

type ConstructNew<linkOpen, linkClose, data> = {|
  blockSize?: number,
  nodeTable?: NodeTableI<LinkOpen, LinkClose, *>
|};

type ConstructClone<linkOpen, linkClose, data> = {|
  blockSize: number,
  nodeTable: NodeTableI<linkOpen, linkClose, data>
  treeTable: TreeTable,
  counter: CounterImmutable,
  rootId: TreeId,
  leftId: TreeId,
  rightId: TreeId,
|};

type ConstructConfig<linkOpen, linkClose, data> =
  ConstructNew<linkOpen, linkClose, data> |
  ConstructClone<linkOpen, linkClose, data>;

class BOTree implements OrderIndexI<LinkOpen, LinkClose, CursorEntry> {

  _blockSize: number;
  _nodeTable: NodeTableI<LinkOpen, LinkClose, *>;
  _treeTable: TreeTable;
  _counter: CounterImmutable;
  _rootId: TreeId;
  _leftId: TreeId;
  _rightId: TreeId;

  // arrow property function to be passed
  // this expects a node table transaction context to be used
  // so it can be done mutably without any problems
  _updateLink = (
    nodeTable: NodeTableTransaction,
    id: NodeId,
    openLink: ?LinkOpen,
    closeLink: ?LinkClose
  ) => {
    if (!openLink && !closeLink) return;
    nodeTable.updateNode(
      id,
      {
        ...openLink,
        ...closeLink
      }
    );
    return;
  }

  constructor (
    config: ConstructConfig<linkOpen, linkClose, data>
  ) {
    if (!config.treeTable) {
      if (config.blockSize == null) {
        config.blockSize = 64;
      } else {
        if (config.blockSize <= 4 || config.blockSize % 2 !== 0) {
          throw new RangeError(
            'blockSize must be at least 4 and an even length for splitting and splicing'
          );
        }
      }
      const [id, counter]= (new CounterImmutable).allocate();
      const blockRoot = new Leaf(id, 0, new ArrayFixedDense(this._blockSize));
      this._blockSize = config.blockSize;
      this._nodeTable = nodeTable;
      this._treeTable = MapI([[id, blockroot]]);
      this._counter = counter;
      this._rootId = id;
      this._leftId = id;
      this._rightId = id;
    } else {
      this._blockSize = config.blockSize;
      this._nodeTable = config.nodeTable;
      this._treeTable = config.treeTable;
      this._counter = config.counter;
      this._rootId = config.id;
      this._leftId = config.id;
      this._rightId = config.id;
    }
  }

  clone (extraParameters: Object): OrderIndexI<LinkOpen, LinkClose, Cursor> {
    const parameters = {
      blockSize: this._blockSize,
      rootId: this._rootId,
      leftId: this._leftId,
      rightId: this._rightId,
      counter: this._counter,
      treeTable: this._treeTable,
      nodeTable: this._nodeTable,
      ...extraParameters
    };
    return new BOTree(parameters);
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

      if (blockLeft.space >= 2) {

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

  insertChild (
    nodeTableT: NodeTableTransaction<LinkOpen, LinkClose, *>,
    openLink: LinkOpen,
    closeLink: LinkClose,
    position: number
  ): [
    [
      LinkOpen,
      LinkClose,
      NodeLevel,
      (NodeId) => void
    ],
    OrderIndexI<LinkOpen, LinkClose, Cursor>
  ] {

  }

  // this function takes a leaf, position and entry
  // and makes sure to be able to insert into that leaf
  // splitting the leaf if necessary
  // if it splits the leaf
  // it will go up to the root
  // by trying to insert child ids of the leaf ids
  // into the tree
  // it makes use of the nodeTableT
  // and the snapshot
  // so it basically assumes that we are in a mutable transaction
  // and will perform the operation
  // the caller of this would then eventually receive the new nodeTableT, treeTableT and counterT
  // while using the snapshot to know whether this objects are already been copied (and so should be within the transaction)

  // this singular insertion can only be used for rootNode insert onto the left and right
  // every other method always inserts within the same leaf
  // since we are always inserting to have 2 spaces
  // oh yea..

  // you need the ability to do more 1 caret at a time
  // so you can caret 1 then the other together
  // so you can say here's a position, and I want you to caret multiple
  // so that's like start at 0, and caret multiple into it


  // this is only used by insertRoot when you have different left and right
  _insertIntoLeaf ({
    nodeTableT,
    treeTableT,
    counterT,
    rootBlock,
    leftBlock,
    rightBlock,
    snapshot,
    leaf,
    position,
    entry
  }: {
    nodeTableT: NodeTableTransaction<LinkOpen, LinkClose, *>,
    treeTableT: TreeTable,
    counterT: CounterTransaction,
    snapshot: SnapShot,
    rootBlock: Tree,
    leftBlock: Leaf,
    rightBlock: Leaf,
    leaf: Leaf,
    position: number,
    entry: OrderEntry
  }): {
    rootBlock: Tree,
    leafBlock: Leaf,
    rightBlock: Leaf,
    leaf: Leaf,
    index: number,
    gapKey: Gapkey
  } {
    if (leaf.space > 1) {
      let leafNew;
      if (!snapshot.has(leaf)) {
        leafNew = leaf.clone();
        snapshot.add(leafNew);
      } else {
        leafNew = leaf;
      }
      const [index, gapKey] = leafNew.caret(position, entry);
      treeTableT.set(leafNew.id, leafNew);
      return {
        rootBlock: rootBlock,
        leftBlock: leftBlock,
        rightBlock: rightBlock,
        leaf: leafNew,
        index: index,
        gapKey: gapKey
      };
    } else {
      const indexCenter = leaf.children.length / 2;
      let leafLeft, leafRight;
      if (!snapshot.has(leaf)) {
        leafLeft = leaf.clone();
      } else {
        leafLeft = leaf;
      }
      const [indexSplit] = leafLeft.caret(position, entry);
      [leafLeft, leafRight] = leafLeft.split(counterT.allocate());
      let index, leafInserted;
      if (index < indexCenter) {
        index = indexSplit;
        leafInserted = leafLeft;
      } else {
        index = indexSplit - indexCenter;
        leafInserted = leafRight;
      }
      const [gapKey] = leafInserted.children.get(index);
      snapshot.add(leafLeft);
      snapshot.add(leafRight);
      treeTableT.set(leafLeft.id, leafLeft);
      treeTableT.set(leafRight.id, leafRight);
      if (!leaf.parentId) {
        const children = [leafLeft.id, leafRight.id];
        children.length = leaf.children.length;
        const rootNode = new Node(
          counterT.allocate(),
          0,
          ArrayFixedDense.fromArray(children, 2, true)
        );
        leafLeft.parentId = rootNode.id;
        leafRight.parentId = rootNode.id;
        treeTableT.set(rootNode.id, rootNode);
        return {
          rootBlock: rootNode,
          leftBlock: leafLeft,
          rightBlock: leafRight,
          leaf: leafInserted,
          index: index,
          gapKey: gapKey
        };
      } else {
        const parentNode = treeTableT.get(leaf.parentId);
        return this._insertIntoNode({
          treeTableT: treeTableT,
          counterT: counterT,
          snapshot: snapshot,
          node: parentNode,
          existingId: leafLeft.id,
          newId: leafRight.id,
          result: {
            rootBlock: rootBlock,
            leftBlock: leafLeft,
            rightBlock: leafRight,
            leaf: leafInserted,
            index: index,
            gapKey: gapKey
          }
        });
      }
    }
  }

  // this gets used most of the time
  // it must make use of a dual caret or caret with multiple
  // it still uses insertIntoNode

  // so this needs to do it for pairs instead of just normal ones
  // we need to then caret in multiple at a time, so we can make sure we can get the right gap keys when we get it back

  _insertIntoLeafPair () {

    // fill this out
    // and implement multi variable caret

  }

  _insertIntoNode (
    {
      treeTableT,
      counterT,
      snapshot,
      node,
      existingId,
      newId,
      result: {
        rootBlock,
        leftBlock,
        rightBlock,
        leaf,
        index,
        gapKey
      }
    }: {
      treeTableT: TreeTable,
      counterT: CounterTransaction,
      snapshot: SnapShot,
      rootId: number,
      node: Node,
      existingId: TreeId,
      newId: TreeId,
      result: {
        rootBlock: Tree,
        leftBlock: Leaf,
        rightBlock: Leaf,
        leaf: Leaf,
        index: number,
        gapKey: Gapkey
      }
    }
  ): {
    rootBlock: Tree,
    leftBlock: Leaf,
    rightBlock: Leaf,
    leaf: Leaf,
    index: number,
    gapKey: Gapkey
  } {
    if (node.space > 1) {
      let nodeNew;
      if (!snapshot.has(node)) {
        nodeNew = node.clone();
        snapshot.add(nodeNew);
      } else {
        nodeNew = node;
      }
      const position = nodeNew.children.findIndex((id) => id === existingId);
      if (position < 0) {
        throw new Error('Missing existing child id');
      }
      nodeNew.caret(position + 1, newId);
      treeTableT.set(nodeNew.id, nodeNew);
      return results;
    } else {
      let nodeLeft, nodeRight;
      if (!snapshot.has(node)) {
        nodeLeft = node.clone();
      } else {
        nodeLeft = node;
      }
      const position = nodeLeft.children.findIndex((id) => id === existingId);
      if (position < 0) {
        throw new Error('Missing existing child id');
      }
      nodeLeft.caret(position, newId);
      [nodeLeft, nodeRight] = nodeLeft.split(counterT.allocate());
      snapshot.add(nodeLeft);
      snapshot.add(nodeRight);
      treeTableT.set(nodeLeft.id, nodeLeft);
      treeTableT.set(nodeRight.id, nodeRight);
      if (!node.parentId) {
        const children = [nodeLeft.id, nodeRight.id];
        children.length = node.children.length;
        const rootNode = new Node(
          counterT.allocate(),
          0,
          ArrayFixedDense.fromArray(children, 2, true)
        );
        nodeLeft.parentId = rootNode.id;
        nodeRight.parentId = rootNode.id;
        treeTableT.set(rootNode.id, rootNode);
        results.rootBlock = rootNode;
        return results;
      } else {
        const parentNode = treeTableT.get(node.parentId);
        return this._insertIntoNode({
          treeTableT: treeTableT,
          counterT: counterT,
          snapshot: snapshot,
          node: parentNode,
          existingId: nodeLeft.id,
          newId: nodeRight.id,
          results: results
        });
      }
    }
  }

  insertRoot (
    data_: data
  ): [
    [
      LinkOpen,
      LinkClose,
      NodeLevel,
      (NodeId) => void
    ],
    OrderIndexI<LinkOpen, LinkClose, Cursor>
  ] {

    const snapshot = new WeakSet;


    // using insertIntoLeaf
    // and insertIntoNode
    // let's see how we can simplify insertRoot


    // we always have node table transaction inserted
    // and we push this down to every function that is needed
    // it is the context that we need
    // but this function also is immutable and so returns a new

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

    // so the alternative
    // is to go from leftId and rightId which are the far left and far right ids
    // and we insert split from there
    // actually we don't always need to split here
    // if we can insert then it's fine
    // also we only need space for 1
    // nothing more
    // this would result in a new tree
    // a new BOTree
    // so we start a transaction with the tree table


    // an alternative to always building out everything is this:
    // you need to +1 to the root level ALWAYS
    // however
    // the level for your own node that you created
    // has oldRoot.level -1
    // specifically the oldRoot's number in the node table
    // and minus 1 to that
    // so since you are always inserting next to the old root
    // that should be fine
    // you just need to find the old root's level first

    let cloneConfig = {};

    const entryOpen = {
      id: null,
      status: true
    };
    const entryClose = {
      id: null,
      status; false
    };
    const fillId = (id) => {
      entryOpen.id = id;
      entryClose.id = id;
    };

    // we always have 2 entries to insert

    const [[
      nodeTable,
      treeTable,
      counter
    ]] = nestContexts([
      this._nodeTable.transaction.bind(this._nodeTable),
      this._treeTable.withMutations.bind(this._treeTable),
      this._counter.transaction.bind(this._counter)
    ], ([nodeTableT, treeTableT, counterT]) => {

      // this may in fact be the base case
      // where we are on the last block
      // however we have different kind of entry whether we are on leaf
      // or on node
      // so we are iterating from bottom to top
      // the worker wrapper pattern means
      // that the wrapper is the careting of entries
      // whereas the worker recurses to the parent (the LCA)
      // in this case the root

      let openLink, closeLink, level;
      // only 1 leaf block that is the root block
      if (this._leftId === this._rightId === this._rootId) {
        const block = treeTableT.get(this._rootId);
        if (!(block instanceof Leaf)) {
          throw new Error('Root block must be a leaf');
        }
        if (block.space >= 2) {
          // prepare careting into the root block
          const blockNew = block.clone();
          // calculate the new level for the new root entry pair
          const rootOpenEntry = block.children.get(0);
          if (!rootOpenEntry) {
            // this would be the first root entry pair inserted
            // the new level is just the opposite of the block level
            level = -block.level;
          } else {
            // there is an existing root entry pair
            // the new level is the existing root level minus 1
            const rootNode = nodeTableT.getNode(rootOpenEntry[0]);
            if (!rootNode) {
              throw new Error('Root entry pair must have a matching node');
            }
            level = rootNode.level - 1;
            // +1 to the root block so that other entry pairs pushed down 1 level
            ++blockNew.level;
          }
          const [, gapKeyOpen] = blockNew.caret(0, entryOpen);
          const [, gapKeyClose] = blockNew.caret(-1, entryClose);
          openLink = {
            leafOpen: blockNew,
            gapKeyOpen: gapKeyOpen
          };
          closeLink = {
            leafClose: blockNew,
            gapKeyClose: gapKeyClose
          };
          treeTableT.set(blockNew.id, blockNew);
        } else {

          // this needs to acquire the level
          // being calculated
          // which requires precalculating the level

          // calculate the new level for the new root entry pair
          const rootOpenEntry = block.children.get(0);
          if (!rootOpenEntry) {
            throw new Error('Filled root block must have root entry pair');
          }
          // the new level is the existing root level minus 1
          const rootNode = nodeTableT.getNode(rootOpenEntry[0]);
          if (!rootNode) {
            throw new Error('Root entry pair must have a matching node');
          }
          level = rootNode.level - 1;
          // split the root block
          const [blockLeft, blockRight] = block.splitI(counterT.allocate());
          // create the new root
          const children = [blockLeft.id, blockRight.id];
          children.length = block.children.length;
          const blockRoot = new Node(
            counterT.allocate(),
            1,
            ArrayFixedDense.fromArray(children, 2, true)
          );
          const [, gapKeyOpen] = blockLeft.caret(0, entryOpen);
          const [, gapKeyClose] = blockRight.caret(-1, entryClose);
          openLink = {
            leafOpen: blockLeft,
            gapKeyOpen: gapKeyOpen
          };
          closeLink = {
            leafClose: blockRight,
            gapKeyCLose: gapKeyClose
          };
          treeTableT.set(blockLeft.id, blockLeft);
          treeTableT.set(blockRight.id, blockRight);
          treeTableT.set(blockRoot.id, blockRoot);
          cloneConfig.rootId = blockRoot.id;
          cloneConfig.leftId = blockLeft.id;
          cloneConfig.rightId = blockRight.id;
        }
      } else {
        const blockRoot = treeTableT.get(this._rootId);
        const blockLeft = treeTableT.get(this._leftId);
        const blockRight = treeTableT.get(this._rightId);
        if (!(blockLeft instanceof Leaf) || !(blockRight instanceof Leaf)) {
          throw new Error('Left and right blocks must be a leaf');
        }
        if (!(blockRoot instanceof Node)) {
          throw new Error('Root block must be a node when left & right blocks are leafs');
        }

        // calculate the new level for the new root entry pair
        const rootOpenEntry = blockLeft.children.get(0);
        if (!rootOpenEntry) {
          throw new Error('Non-empty BOTree must have a root entry pair');
        }
        // the new level is the existing root level minus 1
        const rootNode = nodeTableT.getNode(rootOpenEntry[0]);
        if (!rootNode) {
          throw new Error('Root entry pair must have a matching node');
        }
        level = rootNode.level - 1;

        // the recursive splitting and careting must occur outside the Node/Leaf blocks
        // because this requires knowledge about the counter AND treeTable
        // we don't want to push too much circular references into the Node/Leaf block stuff
        // and keep the Node/Leaf block stuff simple
        // so that means we need a worker function to do recursive splitting and careting
        // it could be made generic to actually support other caret positioning functions

        this._insertIntoLeaf(
          nodeTableT,
          treeTableT,
          counterT,
          snapshot,
          blockLeft,
          0,
          entryOpen
        );

        this._insertIntoLeaf(
          nodeTableT,
          treeTableT,
          counterT,
          snapshot,
          blockRight,
          -1,
          entryClose
        );

        // because this may create a new root
        // do we just use the rootId?
        // no because it's meant to be immutable
        // so each insertion may return the new root?
        // no because each insertion may return a new tree as well
        // yea that makes sense
        // so the idea is that we would need to pass in the
        // imperative context into it
        // so that way the context gets mutated for each
        // and that's the new node table and stuff
        // yea that makes sense

        // ok so we now know the level we want to use
        // but the root block's level needs +1
        // but we cannot do this until we reach the root during splitting careting

        // ok I understand, what we want to do is recurse into insertion now
        // we want to  caret into

        blockLeft.splitI(counterT.allocate());







        // ok we split left first
        // but we can acquire the root entry as well
        // and also if it is emtpy
        // then we throw an error






        // now if they are not the same
        // it means left id and right id are different
        // and not the same as root
        // and they are all different ids!

        // we now need to split and insert from left and right
        // alternatively

      }

      nodeTableT.insertNode(
        level,
        openLink,
        closeLink,
        data_,
        fillId
      );
    });


    cloneConfig.nodeTable = nodeTable;
    cloneConfig.treeTable = treeTable;
    cloneConfig.counter = counter;

    const boTreeNew = this.clone(cloneConfig);

    return [
      [
        openLinkNew,
        closeLinkNew,
        levelNew,
        fillId
      ],
      boTreeNew
    ];




    // ---


    let left, right;
    if (this._leftId === this._rightId) {
      const block = this._treeTable.get(this._leftId);
      if (block.space >= 2) {



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
          if (block.space >= 2) {
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
