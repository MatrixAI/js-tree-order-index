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

  _generateGapKey (index: number): GapKey {
    let childPrev, childNext, childLast;
    const childNext = this.children.get(index);
    if ((index - 1) >= 0) childPrev = this.children.get(index - 1);

    // wait we may no childLast
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

  _relabelGapKeys (
    ignoredIndices: Array<number>
  ) {
    const keys = generateGapKeys(this.children.count);
    let i = 0;
    this.children.forEach((child, index) => {
      child[0] = keys[i];
      ++i;
      if (ignoredIndices.indexOf(index) === -1) {
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
  ): [[GapKey, number], [GapKey, number]] {
    if (this.space < 2) {
      throw new Error('Not enough space to caret in 2 entries');
    }
    position1 = boundIndex(position1, this.children.length - 1);
    position2 = boundIndex(position2, this.children.length - 1);
    if (position1 <= position2 ) {
      throw new Error('Pair positions must be in order and unique');
    }
    let needsRelabelling = false;
    let gapKey1;
    gapKey1 = this._generateGapKey(position1);
    if (gapKey1 == null) {
      needsRelabelling = true;
      gapKey1 = 0;
    }
    this.children.caretRight(position1, [gapKey1, entry1]);
    let gapKey2;
    gapKey2 = this._generateGapKey(position2);
    if (gapKey2 == null) {
      needsRelabelling = true;
      gapKey2 = 0;
    }
    this.children.caretRight(position2, [gapKey2, entry2]);
    if (needsRelabelling) {
      this.relabelGapKeys([position1, position2]);
      gapKey1 = this.children.get(position1)[0];
      gapKey2 = this.children.get(position2)[0];
    }
    return [[gapKey1, position1], [gapKey2, position2]];
  }

  caret (
    position: number,
    entry: OrderEntry
  ): [GapKey, number] {
    if (this.space < 1) {
      throw new Error('Not enough space to caret in 1 entry');
    }
    position = boundIndex(position, this.children.length - 1);
    let needsRelabelling = false;
    let gapKey;
    gapKey = this._generateGapKey(position);
    if (gapKey == null) {
      needsRelabelling = true;
      gapKey = 0;
    }
    this.children.caretRight(position, [gapKey, entry]);
    if (needsRelabelling) {
      this._relabelGapKeys([position]);
      gapKey = this.children.get(position)[0];
    }
    return [gapKey, position];
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
    const leafLeft = this;
    const leafRight = new Leaf(
      idNew,
      childrenRight,
      this.levelDelta,
      this.parentId,
      this.id,
      this.nextId
    );
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
    if (this.space < 1) {
      throw new Error('Not enough space to caret in 1 entry');
    }
    position = boundIndex(position, this.children.length - 1);
    this.children.caretRight(position, value);
    return position;
  }

  split (idNew: TreeId, index?: number): [Node, Node] {
    if (index === undefined) {
      index = this.children.count / 2 ;
    }
    const childrenLeft = this.children.slice(0, index);
    const childrenRight = this.children.slice(index);
    childrenLeft.length = this.children.length;
    childrenRight.length = this.children.length;
    this.children = childrenLeft;
    const nodeLeft = this;
    const nodeRight = new Node(
      idNew,
      childrenRight,
      this.levelDelta,
      this.parentId
    );
    return [
      nodeLeft,
      nodeRight
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
    blockRoot,
    blockLeft,
    blockRight,
    snapshot,
    leaf,
    position,
    entry
  }: {
    nodeTableT: NodeTableTransaction<LinkOpen, LinkClose, *>,
    treeTableT: TreeTable,
    counterT: CounterTransaction,
    snapshot: SnapShot,
    blockRoot: Tree,
    blockLeft: Leaf,
    blockRight: Leaf,
    leaf: Leaf,
    position: number,
    entry: OrderEntry
  }): {
    blockRoot: Tree,
    blockLeft: Leaf,
    blockRight: Leaf,
    leaf: Leaf,
    gapKey: Gapkey,
    index: number
  } {
    if (leaf.space > 1) {
      let leafNew;
      if (!snapshot.has(leaf)) {
        leafNew = leaf.clone();
        snapshot.add(leafNew);
      } else {
        leafNew = leaf;
      }
      const [gapKey, index] = leafNew.caret(position, entry);
      treeTableT.set(leafNew.id, leafNew);
      return {
        blockRoot: blockRoot,
        blockLeft: blockLeft,
        blockRight: blockRight,
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
      const [, indexSplit] = leafLeft.caret(position, entry);
      [leafLeft, leafRight] = leafLeft.split(counterT.allocate());
      // new right block
      if (leaf === blockRight) {
        blockRight = leafRight;
      }
      let leafInserted, index;
      if (indexSplit < indexCenter) {
        leafInserted = leafLeft;
        index = indexSplit;
      } else {
        leafInserted = leafRight;
        index = indexSplit - indexCenter;
      }
      const [gapKey] = leafInserted.children.get(index);
      snapshot.add(leafLeft);
      snapshot.add(leafRight);
      treeTableT.set(leafLeft.id, leafLeft);
      treeTableT.set(leafRight.id, leafRight);
      if (!leaf.parentId) {
        const children = [leafLeft.id, leafRight.id];
        children.length = leaf.children.length;
        // new root block
        blockRoot = new Node(
          counterT.allocate(),
          0,
          ArrayFixedDense.fromArray(children, 2, true)
        );
        leafLeft.parentId = blockRoot.id;
        leafRight.parentId = blockRoot.id;
        treeTableT.set(blockRoot.id, blockRoot);
        return {
          blockRoot: blockRoot,
          blockLeft: blockLeft,
          blockRight: blockRight,
          leaf: leafInserted,
          gapKey: gapKey,
          index: index
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
            blockRoot: blockRoot,
            blockLeft: blockLeft,
            blockRight: blockRight,
            leaf: leafInserted,
            gapKey: gapKey,
            index: index
          }
        });
      }
    }
  }

  _insertIntoLeafPair({
    nodeTableT,
    treeTableT,
    counterT,
    snapshot,
    blockRoot,
    blockLeft,
    blockRight,
    leaf,
    position1,
    entry1,
    position2,
    entry2
  }: {
    nodeTableT: NodeTableTransaction<LinkOpen, LinkClose, *>,
    treeTableT: TreeTable,
    counterT: CounterTransaction,
    snapshot: SnapShot,
    blockRoot: Tree,
    blockLeft: Leaf,
    blockRight: Leaf,
    leaf: Leaf,
    position1: number,
    entry1: OrderEntry,
    position2: number,
    entry2: OrderEntry
  }): {
    blockRoot: Tree,
    blockLeft: Leaf,
    blockRight: Leaf,
    leaf1: Leaf,
    gapKey1: Gapkey,
    index1: number,
    leaf2: Leaf,
    gapKey2: GapKey,
    index2: number
  } {
    if (leaf.space > 2) {
      let leafNew;
      if (!snapshot.has(leaf)) {
        leafNew = leaf.clone();
        snapshot.add(leafNew);
      } else {
        leafNew = leaf;
      }
      const [[gapKey1, index1], [gapKey2, index2]] = leafNew.caretPair(
        position1,
        entry1,
        position2,
        entry2
      );
      treeTableT.set(leafNew.id, leafNew);
      return {
        blockRoot: blockRoot,
        blockLeft: blockLeft,
        blockRight: blockRight,
        leaf1: leafNew,
        gapKey1: gapKey1,
        index1: index1,
        leaf2: leafNew,
        gapKey2: gapKey2,
        index2: index2
      };
    } else {
      const indexCenter = leaf.children.length / 2;
      let leafLeft, leafRight;
      if (!snapshot.has(leaf)) {
        leafLeft = leaf.clone();
      } else {
        leafLeft = leaf;
      }
      const [[, indexSplit1], [, indexSplit2]] = leafLeft.caretPair(
        position1,
        entry1,
        position2,
        entry2
      );
      [leafLeft, leafRight] = leafLeft.split(counterT.allocate());
      // new right block
      if (leaf === blockRight) {
        blockRight = leafRight;
      }
      let leafInserted1, index1, leafInserted2, index2;
      if (indexSplit1 < indexCenter) {
        leafInserted1 = leafLeft;
        index1 = indexSplit1;
      } else {
        leafInserted1 = leafRight;
        index1 = indexSplit1 - indexCenter;
      }
      if (indexSplit2 < indexCenter) {
        leafInserted2 = leafLeft;
        index2 = indexSplit2;
      } else {
        leafInserted2 = leafRight;
        index2 = indexSplit2 - indexCenter;
      }
      const [gapKey1] = leafInserted1.children.get(index1);
      const [gapKey2] = leafInserted2.children.get(index2);
      snapshot.add(leafLeft);
      snapshot.add(leafRight);
      treeTableT.set(leafLeft.id, leafLeft);
      treeTableT.set(leafRight.id, leafRight);
      if (!leaf.parentId) {
        const children = [leafLeft.id, leafRight.id];
        children.length = leaf.children.length;
        // new root block
        blockRoot = new Node(
          counterT.allocate(),
          0,
          ArrayFixedDense.fromArray(children, 2, true)
        );
        leafLeft.parentId = blockRoot.id;
        leafRight.parentId = blockRoot.id;
        treeTableT.set(blockRoot.id, blockRoot);
        return {
          blockRoot: blockRoot,
          blockLeft: blockLeft,
          blockRight: blockRight,
          leaf1: leafInserted1,
          gapKey1: gapKey1,
          index1: index1,
          leaf2: leafInserted2,
          gapKey2: gapKey2,
          index2: index2
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
            blockRoot: blockRoot,
            blockLeft: blockLeft,
            blockRight: blockRight,
            leaf1: leafInserted1,
            gapKey1: gapKey1,
            index1: index1,
            leaf2: leafInserted2,
            gapKey2: gapKey2,
            index2: index2
          }
        });
      }
    }
  }

  _insertIntoNode<Result: { blockRoot: Tree }> (
    {
      treeTableT,
      counterT,
      snapshot,
      node,
      existingId,
      newId,
      result
    }: {
      treeTableT: TreeTable,
      counterT: CounterTransaction,
      snapshot: SnapShot,
      node: Node,
      existingId: TreeId,
      newId: TreeId,
      result: Result
    }
  ): Result {
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
      return result;
    } else {
      let nodeLeft, nodeRight;
      if (!snapshot.has(node)) {
        nodeLeft = node.clone();
      } else {
        nodeLeft = node;
      }
      const position = nodeLeft.children.findIndex((id) => id === existingId);
      nodeLeft.caret(position, newId);
      [nodeLeft, nodeRight] = nodeLeft.split(counterT.allocate());
      snapshot.add(nodeLeft);
      snapshot.add(nodeRight);
      treeTableT.set(nodeLeft.id, nodeLeft);
      treeTableT.set(nodeRight.id, nodeRight);
      if (!node.parentId) {
        const children = [nodeLeft.id, nodeRight.id];
        children.length = node.children.length;
        blockRoot = new Node(
          counterT.allocate(),
          0,
          ArrayFixedDense.fromArray(children, 2, true)
        );
        nodeLeft.parentId = blockRoot.id;
        nodeRight.parentId = blockRoot.id;
        treeTableT.set(blockRoot.id, blockRoot);
        result.blockRoot = blockRoot;
        return result;
      } else {
        const parentNode = treeTableT.get(node.parentId);
        return this._insertIntoNode({
          treeTableT: treeTableT,
          counterT: counterT,
          snapshot: snapshot,
          node: parentNode,
          existingId: nodeLeft.id,
          newId: nodeRight.id,
          result: result
        });
      }
    }
  }

  insertRoot (
    data_: data
  ): [
    Node<LinkOpen, LinkClose, *>
    OrderIndexI<LinkOpen, LinkClose, Cursor>
  ] {
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
    const snapshot = new WeakSet;
    const cloneConfig = {};
    let nodeInserted;
    const [[
      nodeTable,
      treeTable,
      counter
    ]] = nestContexts([
      this._nodeTable.transaction.bind(this._nodeTable),
      this._treeTable.withMutations.bind(this._treeTable),
      this._counter.transaction.bind(this._counter)
    ], ([nodeTableT, treeTableT, counterT]) => {
      let openLink, closeLink, level;
      // when we only have 1 block
      if (this._leftId === this._rightId === this._rootId) {
        const block = treeTableT.get(this._rootId);
        let levelRootDelta = 0;
        if (block.children.count) {
          const rootOpenEntry = block.children.get(0);
          const rootNode = nodeTableT.getNode(rootOpenEntry[0]);
          if (!rootNode) throw new Error();
          level = rootNode.level - 1;
          ++levelRootDelta;
        } else {
          level = -block.level;
        }
        const {
          blockRoot,
          blockLeft,
          blockRight,
          leaf1: leafOpen,
          gapKey1: gapKeyOpen,
          leaf2: leafClose,
          gapKey2: gapKeyClose
        } = this._insertIntoLeafPair({
          nodeTableT,
          treeTableT,
          counterT,
          snapshot,
          blockRoot: block,
          blockLeft: block,
          blockRight: block,
          leaf: block,
          position1: 0,
          entry1: entryOpen,
          position2: -1,
          entry2: entryClose
        });
        openLink = {leafOpen, gapKeyOpen};
        closeLink = {leafClose, gapKeyClose};
        cloneConfig.rootId = blockRoot.id;
        cloneConfig.leftId = blockLeft.id;
        cloneConfig.rightId = blockRight.id;
      } else {
        // we have a tree of blocks
        // new root insertion inserts into the far left and far right
        let blockRoot = treeTableT.get(this._rootId);
        let blockLeft = treeTableT.get(this._leftId);
        let blockRight = treeTableT.get(this._rightId);
        // in this case, the root entry must exist
        const rootOpenEntry = blockLeft.children.get(0);
        const rootNode = nodeTableT.getNode(rootOpenEntry[0]);
        level = rootNode.level - 1;
        let leafOpen, gapKeyOpen, leafClose, gapKeyClose;
        {
          blockRoot,
          blockLeft,
          blockRight,
          leaf: leafOpen,
          gapKey: gapKeyOpen
        } = this._insertIntoLeaf({
          nodeTableT,
          treeTableT,
          counterT,
          snapshot,
          blockRoot,
          blockLeft,
          blockRight,
          leaf: blockLeft,
          position: 0,
          entry: entryOpen
        });
        {
          blockRoot,
          blockLeft,
          blockRight,
          leaf: leafClose,
          gapKey: gapKeyClose
        } = this._insertIntoLeaf({
          nodeTableT,
          treeTableT,
          counterT,
          snapshot,
          blockRoot,
          blockLeft,
          blockRight,
          leaf: blockRight,
          position: -1,
          entry: entryClose
        });
        openLink = {leafOpen, gapKeyOpen};
        closeLink = {leafClose, gapKeyClose};
        cloneConfig.rootId = blockRoot.id;
        cloneConfig.leftId = blockLeft.id;
        cloneConfig.rightId = blockRight.id;
      }
      nodeInserted = nodeTableT.insertNode(
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
    const boTree = this.clone(cloneConfig);
    return [nodeInserted, boTree];
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
