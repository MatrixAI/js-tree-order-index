// @flow

import type { CounterTransaction } from 'resource-counter';

import type {
  OrderEntry,
  OrderCursorI,
  OrderIndexI
} from '../OrderIndex.js';

import type {
  NodeId,
  NodeLevel,
  NodeTableI,
  NodeTableTransaction
} from '../NodeTable.js';

import type { Tree, TreeId } from './BlockTree.js';
import type {
  GapLink,
  TableLinkOpen,
  TableLinkClose,
  UpdateNodeLink,
  UpdateTreeLink
} from './Links.js';

import { CounterImmutable } from 'resource-counter';
import { Map as MapI } from 'immutable';
import { ArrayFixedDense } from 'array-fixed';

import { Leaf, Node } from './BlockTree.js';
import { interpolationSearch, nestContexts } from '../utilities.js';

type GapKey = number;
type SnapShot = WeakSet<Tree<OrderEntry>>;
type TreeTable = MapI<TreeId, Tree<OrderEntry>>;

class Cursor<data> implements OrderCursorI {

  _orderIndex: BOITree<data>;
  _leaf: Leaf<OrderEntry>;
  _index: number;

  constructor (orderIndex: BOITree<data>, leaf: Leaf<OrderEntry>, index: number) {
    this._orderIndex = orderIndex;
    this._leaf = leaf;
    this._index = index;
  }

  next (): { done: false, value: OrderEntry } | { done: true } {
    if (this._index < (this._leaf.children.count - 1)) {
      this._index += 1;
      return {
        done: false,
        value: this._leaf.children.get(this._index).link
      };
    } else if (this._leaf.nextId != null) {
      const leafNext = (
        (
          this._orderIndex._treeTable.get(
            this._leaf.nextId
          ): any
        ): Leaf<OrderEntry>
      );
      const value = leafNext.children.get(0);
      if (value) {
        this._leaf = leafNext;
        this._index = 0;
        return {
          done: false,
          value: value.link
        };
      }
    }
    return {
      done: true
    };
  }

  nextSiblingOpen (): { done: false, value: OrderEntry } | { done: true } {
    const leafOld = this._leaf;
    const indexOld = this._index;
    const [, entry] = this._leaf.children.get(this._index);
    if (entry.status) {
      this.jumpClose();
    }
    const result = this.next();
    if (!result.done && !result.value.status) {
      this._leaf = leafOld;
      this._index = indexOld;
      return { done: true };
    }
    return result;
  }

  nextSiblingClose (): { done: false, value: OrderEntry } | { done: true } {
    const leafOld = this._leaf;
    const indexOld = this._index;
    let entry;
    [, entry] = this._leaf.children.get(this._index);
    if (entry.status) {
      this.jumpClose();
    }
    const result = this.next();
    if (result.done) {
      // there is no next
      return result;
    } else if (!result.done && !result.value.status) {
      // next is a closing entry
      this._leaf = leafOld;
      this._index = indexOld;
      return { done: true };
    }
    // next is an opening entry
    this.jumpClose();
    [, entry] = this._leaf.children.get(this._index);
    return {
      done: false,
      value: entry
    };
  }

  prev (): { done: false, value: OrderEntry } | { done: true } {
    if (this._index > 0) {
      this._index -= 1;
      return {
        done: false,
        value: this._leaf.children.get(this._index).link
      };
    } else if (this._leaf.prevId != null) {
      const leafPrev = (
        (
          this._orderIndex._treeTable.get(
            this._leaf.prevId
          ): any
        ): Leaf<OrderEntry>
      );
      const value = leafPrev.children.get(leafPrev.children.count - 1);
      if (value) {
        this._leaf = leafPrev;
        this._index = leafPrev.children.count - 1;
        return {
          done: false,
          value: value.link
        };
      }
    }
    return {
      done: true
    };
  }

  prevSiblingOpen (): { done: false, value: OrderEntry } | { done: true }  {
    const leafOld = this._leaf;
    const indexOld = this._index;
    let entry;
    [, entry] = this._leaf.children.get(this._index);
    if (!entry.status) {
      this.jumpOpen();
    }
    const result = this.prev();
    if (result.done) {
      // there is no prev
      return result;
    } else if (!result.done && result.value.status) {
      // prev is an open entry
      this._leaf = leafOld;
      this._index = indexOld;
      return { done: true };
    }
    // prev is a closing entry
    this.jumpOpen();
    [, entry] = this._leaf.children.get(this._index);
    return {
      done: false,
      value: entry
    };
  }

  prevSiblingClose (): { done: false, value: OrderEntry } | { done: true }  {
    const leafOld = this._leaf;
    const indexOld = this._index;
    const [, entry] = this._leaf.children.get(this._index);
    if (!entry.status) {
      this.jumpOpen();
    }
    const result = this.prev();
    if (!result.done && result.value.status) {
      this._leaf = leafOld;
      this._index = indexOld;
      return { done: true };
    }
    return result;
  }

  up (): { done: false, value: OrderEntry } | { done: true }  {
    const leafOld = this._leaf;
    const indexOld = this._index;
    const [, entry] = this._leaf.children.get(this._index);
    let done = false;
    let result;
    if (entry.status) {
      while (!done) {
        done = this.prevSiblingOpen().done;
      }
      result = this.prev();
    } else {
      while (!done) {
        done = this.nextSiblingClose().done;
      }
      result = this.next();
    }
    if (result.done) {
      this._leaf = leafOld;
      this._index = indexOld;
    }
    return result;
  }

  down (): { done: false, value: OrderEntry } | { done: true }  {
    const leafOld = this._leaf;
    const indexOld = this._index;
    const [, entry] = this._leaf.children.get(this._index);
    let result;
    if (entry.status) {
      result = this.next();
      if (!result.done && !result.value.status) {
        this._leaf = leafOld;
        this._index = indexOld;
        return { done: true };
      }
    } else {
      result = this.prev();
      if (!result.done && result.value.status) {
        this._leaf = leafOld;
        this._index = indexOld;
        return { done: true };
      }
    }
    return result;
  }

  jumpOpen (): void {
    const [, entry] = this._leaf.children.get(this._index);
    if (entry.status) {
      return;
    }
    const node = this._orderIndex._nodeTable.getNode(entry.id);
    const leaf = this._orderIndex._treeTable.get(node.leafOpenId);
    const [index] = interpolationSearch(
      node.gapKeyOpen,
      leaf.children.count,
      (index) => leaf.children.get(index).key
    );
    this._leaf = leaf;
    this._index = index;
    return;
  }

  jumpClose (): void {
    const [, entry] = this._leaf.children.get(this._index);
    if (!entry.status) {
      return;
    }
    const node = this._orderIndex._nodeTable.getNode(entry.id);
    const leaf = this._orderIndex._treeTable.get(node.leafCloseId);
    const [index] = interpolationSearch(
      node.gapKeyClose,
      leaf.children.count,
      (index) => leaf.children.get(index).key
    );
    this._leaf = leaf;
    this._index = index;
    return;
  }

  get leaf () {
    return this._leaf;
  }

  get index () {
    return this._index;
  }

  getEntry (): OrderEntry {
    return this._leaf.children.get(this._index).link;
  }

  toLink (): TableLinkOpen|TableLinkClose {
    const [gapKey, entry] = this._leaf.children.get(this._index);
    if (entry.status) {
      return {
        leafOpenId: this._leaf.id,
        gapKeyOpen: gapKey
      };
    } else {
      return {
        leafCloseId: this._leaf.id,
        gapKeyClose: gapKey
      };
    }
  }

}

type ConstructNew<linkOpen, linkClose, data> = {|
  blockSize?: number,
  nodeTable: NodeTableI<linkOpen, linkClose, data>
|};

type ConstructClone<linkOpen, linkClose, data> = {|
  blockSize: number,
  nodeTable: NodeTableI<linkOpen, linkClose, data>,
  treeTable: TreeTable,
  counter: CounterImmutable,
  rootId: TreeId,
  leftId: TreeId,
  rightId: TreeId,
|};

type ConstructConfig<linkOpen, linkClose, data> =
  ConstructNew<linkOpen, linkClose, data> |
  ConstructClone<linkOpen, linkClose, data>;

// we need wrap the node
// such that public access to the node properties
// like node.level
// perform a proper level access
// which traverses the tree
// and flushes the level and thus is asymptotic constant time
// doesn't this mean the user doesn't get direct access to the node table?
// because if they did, they would end up being get the direct node
// or what we can do is make the level not an accessible property
// or just that level is just a partial level
// not the real level

class BOITree<data: *> implements OrderIndexI<TableLinkOpen, TableLinkClose, data> {

  _blockSize: number;
  _nodeTable: NodeTableI<TableLinkOpen, TableLinkClose, data>;
  _treeTable: TreeTable;
  _counter: CounterImmutable;
  _rootId: TreeId;
  _leftId: TreeId;
  _rightId: TreeId;

  constructor (
    config: ConstructConfig<TableLinkOpen, TableLinkClose, data>
  ) {
    if (!config.treeTable) {
      if (config.blockSize != null) {
        if (config.blockSize < 4 || config.blockSize % 2 !== 0) {
          throw new RangeError('blockSize must be at least 4 and an even length');
        }
        this._blockSize = config.blockSize;
      } else {
        this._blockSize = 64;
      }
      const [id, counter]= (new CounterImmutable).allocate();
      const blockRoot = new Leaf(id, 0, new ArrayFixedDense(config.blockSize));
      this._nodeTable = config.nodeTable;
      this._treeTable = MapI([[id, blockRoot]]);
      this._counter = counter;
      this._rootId = id;
      this._leftId = id;
      this._rightId = id;
    } else {
      this._blockSize = config.blockSize;
      this._nodeTable = config.nodeTable;
      this._treeTable = config.treeTable;
      this._counter = config.counter;
      this._rootId = config.rootId;
      this._leftId = config.leftId;
      this._rightId = config.rightId;
    }
  }

  clone (
    parameters: Object = {}
  ): OrderIndexI<Cursor, TableLinkOpen, TableLinkClose, data> {
    return new BOITree({
      nodeTable: this._nodeTable,
      treeTable: this._treeTable,
      counter: this._counter,
      blockSize: this._blockSize,
      rootId: this._rootId,
      leftId: this._leftId,
      rightId: this._rightId,
      ...parameters
    });
  }

  insertRoot (
    data_: data
  ): [
    NodeId,
    OrderIndexI<Cursor, TableLinkOpen, TableLinkClose, data>
  ] {
    const entryOpen = {
      id: null,
      status: true
    };
    const entryClose = {
      id: null,
      status: false
    };
    const fillId = (id) => {
      // $FlowFixMe: ignore null
      entryOpen.id = id;
      // $FlowFixMe: ignore null
      entryClose.id = id;
    };
    const snapshot = new WeakSet;
    const cloneConfig = {};
    let nodeInsertedId;
    // $FlowFixMe: nestContexts requires dependent types
    const [[
      nodeTable,
      treeTable,
      counter
    ]] = nestContexts(
      [
        this._nodeTable.transaction.bind(this._nodeTable),
        this._treeTable.withMutations.bind(this._treeTable),
        this._counter.transaction.bind(this._counter)
      ],
      (
        [
          nodeTableT,
          treeTableT,
          counterT
        ]: [
          NodeTableTransaction<TableLinkOpen, TableLinkClose, data>,
          TreeTable,
          CounterTransaction
        ]
      ) => {
        const updateNodeLink = (id, openLinkUpdated, closeLinkUpdated) => {
          if (!openLinkUpdated && !closeLinkUpdated) return;
          nodeTableT.updateNode(
            id,
            {...openLinkUpdated, ...closeLinkUpdated}
          );
          return;
        };
        let openLink, closeLink, level;
        if (
          (this._rootId === this._leftId) &&
          (this._rootId === this._rightId)
        ) {
          const block = treeTableT.get(this._rootId);
          let levelRootDelta = 0;
          if (block.children.count) {
            const rootOpenEntry = block.children.get(0);
            const rootNode = nodeTableT.getNode(rootOpenEntry.link.id);
            if (!rootNode) throw new Error('Root entry must have root node');
            level = rootNode.level_ - 1;
            ++levelRootDelta;
          } else {
            level = -block.levelDelta;
          }
          const {
            blockRoot,
            blockLeft,
            blockRight,
            leaf1: leafOpen,
            gapKey1: gapKeyOpen,
            leaf2: leafClose,
            gapKey2: gapKeyClose
          // $FlowFixMe: block is a leaf
          } = this._insertIntoLeafPair({
            nodeTableT,
            treeTableT,
            counterT,
            snapshot,
            updateNodeLink,
            blockRoot: block,
            blockLeft: block,
            blockRight: block,
            leaf: block,
            position1: 0,
            entry1: entryOpen,
            position2: -1,
            entry2: entryClose
          });
          openLink = {
            leafOpenId: leafOpen.id,
            gapKeyOpen
          };
          closeLink = {
            leafCloseId: leafClose.id,
            gapKeyClose
          };
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
          const rootNode = nodeTableT.getNode(rootOpenEntry.link.id);
          if (!rootNode) throw new Error('Root node not found');
          level = rootNode.level_ - 1;
          let leafOpen, gapKeyOpen, leafClose, gapKeyClose;
          ({
            blockRoot,
            blockLeft,
            blockRight,
            leaf: leafOpen,
            gapKey: gapKeyOpen
          // $FlowFixMe: blockLeft and blockRight is a leaf, while blockRoot is a node
          } = this._insertIntoLeaf({
            nodeTableT,
            treeTableT,
            counterT,
            snapshot,
            updateNodeLink,
            blockRoot,
            blockLeft,
            blockRight,
            leaf: blockLeft,
            position: 0,
            entry: entryOpen
          }));
          ({
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
            updateNodeLink,
            blockRoot,
            blockLeft,
            blockRight,
            leaf: blockRight,
            position: -1,
            entry: entryClose
          }));
          openLink = {
            leafOpenId: leafOpen.id,
            gapKeyOpen
          };
          closeLink = {
            leafCloseId: leafClose.id,
            gapKeyClose
          };
          if (!snapshot.has(blockRoot)) {
            blockRoot = blockRoot.clone();
          }
          ++blockRoot.levelDelta;
          treeTableT.set(blockRoot.id, blockRoot);
          cloneConfig.rootId = blockRoot.id;
          cloneConfig.leftId = blockLeft.id;
          cloneConfig.rightId = blockRight.id;
        }
        nodeInsertedId = nodeTableT.insertNode(
          level,
          openLink,
          closeLink,
          data_,
          fillId
        ).id;
      }
    );
    cloneConfig.nodeTable = nodeTable;
    cloneConfig.treeTable = treeTable;
    cloneConfig.counter = counter;
    const boiTree = this.clone(cloneConfig);
    // $FlowFixMe: nodeInsertedId is built dynamically
    return [nodeInsertedId, boiTree];
  }

  insertChild (
    parentNodeId: NodeId,
    position: number,
    data_: data
  ): [
    NodeId,
    OrderIndexI<Cursor, TableLinkOpen, TableLinkClose, data>
  ] {
    const parentNode = this._nodeTable.getNode(parentNodeId);
    if (!parentNode) {
      throw new Error('Unknown parent node id');
    }
    const entryOpen = {
      id: null,
      status: true
    };
    const entryClose = {
      id: null,
      status: false
    };
    const fillId = (id) => {
      entryOpen.id = id;
      entryClose.id = id;
    };
    const snapshot = new WeakSet;
    const cloneConfig = {};
    let nodeInsertedId;
    const [[
      nodeTable,
      treeTable,
      counter
    ]] = nestContexts(
      [
        this._nodeTable.transaction.bind(this._nodeTable),
        this._treeTable.withMutations.bind(this._treeTable),
        this._counter.transaction.bind(this._counter)
      ],
      (
        [
          nodeTableT,
          treeTableT,
          counterT
        ]: [
          NodeTableTransaction<TableLinkOpen, TableLinkClose, data>,
          TreeTable,
          CounterTransaction
        ]
      ) => {
        const updateNodeLink = (id, openLinkUpdated, closeLinkUpdated) => {
          if (!openLinkUpdated && !closeLinkUpdated) return;
          nodeTableT.updateNode(
            id,
            {...openLinkUpdated, ...closeLinkUpdated}
          );
          return;
        };
        let blockRoot;
        let blockLeft;
        let blockRight;
        if (this._rootId === this._leftId && this._rootId === this._rightId) {
          const block = treeTableT.get(this._rootId);
          blockRoot = block;
          blockLeft = block;
          blockRight = block;
        } else {
          blockRoot = treeTableT.get(this._rootId);
          blockLeft = treeTableT.get(this._leftId);
          blockRight = treeTableT.get(this._rightId);
        }
        let direction;
        let cursor;
        if (position === 0) {
          cursor = this._getCursorOpen(parentNode);
          direction = true;
        } else if (position > 0) {
          cursor = this._getCursorOpen(parentNode);
          const result = cursor.down();
          if (!result.done) {
            cursor.jumpClose()
            let done = false;
            while (!done && position > 0) {
              done = cursor.nextSiblingClose().done;
              --position;
            }
          }
          direction = true;
        } else if (position === -1) {
          cursor = this._getCursorClose(parentNode);
          direction = false;
        } else if (position < -1) {
          cursor = this._getCursorClose(parentNode);
          const result = cursor.down();
          if (!result.done) {
            cursor.jumpOpen()
            let done = false;
            while (!done && position < 0) {
              done = cursor.prevSiblingOpen().done;
              ++position;
            }
          }
          direction = false;
        }
        const leaf = cursor.leaf;
        let position1;
        let position2;
        // if we are inserting on the right
        // the positions start on the right of the cursor.index
        // if we are inserting on the left
        // the positions start where the cursor.index is
        if (direction) {
          position1 = cursor.index + 1;
          position2 = position1 + 1;
        } else {
          position1 = cursor.index;
          position2 = position1 + 1;
        }
        let leafOpen, gapKeyOpen, leafClose, gapKeyClose;
        ({
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
          updateNodeLink,
          blockRoot,
          blockLeft,
          blockRight,
          leaf,
          position1,
          entry1: entryOpen,
          position2,
          entry2: entryClose
        }));
        const openLink = {
          leafOpenId: leafOpen.id,
          gapKeyOpen
        };
        const closeLink = {
          leafCloseId: leafClose.id,
          gapKeyClose
        };
        cloneConfig.rootId = blockRoot.id;
        cloneConfig.leftId = blockLeft.id;
        cloneConfig.rightId = blockRight.id;
        // the new level is the parentNode's level + 1
        // this is just the level inside the node table
        // not the true level
        nodeInsertedId = nodeTableT.insertNode(
          parentNode.level_ + 1,
          openLink,
          closeLink,
          data_,
          fillId
        ).id;
      }
    )
    cloneConfig.nodeTable = nodeTable;
    cloneConfig.treeTable = treeTable;
    cloneConfig.counter = counter;
    const boiTree = this.clone(cloneConfig);
    return [nodeInsertedId, boiTree];
  }

  firstCursor (): ?OrderCursorI {
    const leafLeft = this._treeTable.get(this._leftId);
    if (leafLeft.children.get(0)) {
      // $FlowFixMe: leafLeft is a leaf
      return new Cursor(this, leafLeft, 0);
    } else {
      return null;
    }
  }

  lastCursor (): ?OrderCursorI {
    const leafRight = this._treeTable.get(this._rightId);
    if (leafRight.children.get(leafRight.children.count - 1)) {
      // $FlowFixMe: leafRight is a leaf
      return new Cursor(this, leafRight, leafRight.children.count - 1);
    } else {
      return null;
    }
  }

  _getCursorOpen (link: TableLinkOpen): OrderCursorI {
    const leaf = this._treeTable.get(link.leafOpenId);
    const [index] = interpolationSearch(
      link.gapKeyOpen,
      leaf.children.count,
      (index) => leaf.children.get(index).key
    );
    return new Cursor(this, leaf, index);
  }

  _getCursorClose (link: TableLinkClose): OrderCursorI {
    const leaf = this._treeTable.get(link.leafCloseId);
    const [index] = interpolationSearch(
      link.gapKeyClose,
      leaf.children.count,
      (index) => leaf.children.get(index).key
    );
    return new Cursor(this, leaf, index);
  }

  _insertIntoLeaf ({
    nodeTableT,
    treeTableT,
    counterT,
    snapshot,
    updateNodeLink,
    blockRoot,
    blockLeft,
    blockRight,
    leaf,
    position,
    entry
  }: {
    nodeTableT: NodeTableTransaction<TableLinkOpen, TableLinkClose, data>,
    treeTableT: TreeTable,
    counterT: CounterTransaction,
    snapshot: SnapShot,
    updateNodeLink: UpdateNodeLink,
    blockRoot: Tree<OrderEntry>,
    blockLeft: Leaf<OrderEntry>,
    blockRight: Leaf<OrderEntry>,
    leaf: Leaf<OrderEntry>,
    position: number,
    entry: OrderEntry
  }): {
    blockRoot: Tree<OrderEntry>,
    blockLeft: Leaf<OrderEntry>,
    blockRight: Leaf<OrderEntry>,
    leaf: Leaf<OrderEntry>,
    gapKey: GapKey,
    index: number
  } {
    // there must be at least 3 spaces
    // such that when an entry is inserted
    // there's always at least 2 spaces left
    // for subsequent insertion
    if (leaf.space > 2) {
      let leafNew;
      if (!snapshot.has(leaf)) {
        leafNew = leaf.clone();
        snapshot.add(leafNew);
        treeTableT.set(leafNew.id, leafNew);
        if (blockLeft === leaf) {
          blockLeft = leafNew;
        }
        if (blockRight === leaf) {
          blockRight = leafNew;
        }
        if (blockRoot === leaf) {
          blockRoot = leafNew;
        }
      } else {
        leafNew = leaf;
      }
      const [gapKey, index] = leafNew.caret(updateNodeLink, position, entry);
      return {
        blockRoot: blockRoot,
        blockLeft: blockLeft,
        blockRight: blockRight,
        leaf: leafNew,
        index: index,
        gapKey: gapKey
      };
    } else {
      // center split of the count will be inclusive of the middle
      const indexCenter = leaf.children.count / 2;
      let leafLeft, leafRight;
      if (!snapshot.has(leaf)) {
        leafLeft = leaf.clone();
        snapshot.add(leafLeft);
        treeTableT.set(leafLeft.id, leafLeft);
        if (blockLeft === leaf) {
          blockLeft = leafLeft;
        }
      } else {
        leafLeft = leaf;
      }
      // indexSplit must be the index at which the entry was inserted
      const [, indexSplit] = leafLeft.caret(updateNodeLink, position, entry);
      [leafLeft, leafRight] = leafLeft.split(updateNodeLink, counterT.allocate());
      snapshot.add(leafRight);
      treeTableT.set(leafRight.id, leafRight);
      if (blockRight === leaf) {
        blockRight = leafRight;
      }
      if (leafRight.nextId != null) {
        const leafRightRight = treeTableT.get(leafRight.nextId);
        let leafRightRightNew;
        if (!snapshot.has(leafRightRight)) {
          leafRightRightNew = leafRightRight.clone();
          snapshot.add(leafRightRightNew);
          treeTableT.set(leafRightRightNew.id, leafRightRightNew);
          if (blockRight === leafRightRight) {
            // $FlowFixMe: leafRightRightNew is a Leaf
            blockRight = leafRightRightNew;
          }
        } else {
          leafRightRightNew = leafRightRight;
        }
        // $FlowFixMe: leafRightRightNew is a Leaf
        leafRightRightNew.prevId = leafRight.id;
      }
      // due to split, we need to correct indexSplit to index
      let leafInserted, index;
      if (indexSplit <= indexCenter) {
        leafInserted = leafLeft;
        index = indexSplit;
      } else {
        leafInserted = leafRight;
        index = indexSplit - indexCenter - 1;
      }
      const gapKey = leafInserted.children.get(index).key;
      if (!leaf.parentLink) {
        const children = Node.prepChildren(
          [leafLeft.id, leafRight.id],
          leaf.children.length
        );
        const blockRoot = new Node(counterT.allocate(), 0, children);
        leafLeft.parentLink = {
          link: blockRoot.id,
          key: children[0].key
        };
        leafRight.parentLink = {
          link: blockRoot.id,
          key: children[1].key
        };
        snapshot.add(blockRoot);
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
        const updateTreeLink = (id, parentLink) => {
          if (!parentLink) return;
          const tree = treeTableT.get(id);
          if (!snaphsot.has(tree)) {
            const treeNew = tree.clone();
            treeNew.parentLink = parentLink;
            snapshot.add(treeNew);
            treeTableT.set(id, treeNew);
          } else {
            tree.parentLink = parentLink;
          }
          return;
        };
        const parentNode = treeTableT.get(leaf.parentLink.link);
        return this._insertIntoNode({
          treeTableT,
          counterT,
          snapshot,
          updateTreeLink,
          node: parentNode,
          childKey: leaf.parentLink.key,
          child: leafRight.id,
          result: {
            blockRoot,
            blockLeft,
            blockRight,
            leaf: leafInserted,
            gapKey,
            index
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
    updateNodeLink,
    blockRoot,
    blockLeft,
    blockRight,
    leaf,
    position1,
    entry1,
    position2,
    entry2
  }: {
    nodeTableT: NodeTableTransaction<TableLinkOpen, TableLinkClose, data>,
    treeTableT: TreeTable,
    counterT: CounterTransaction,
    snapshot: SnapShot,
    updateNodeLink: UpdateNodeLink,
    blockRoot: Tree<OrderEntry>,
    blockLeft: Leaf<OrderEntry>,
    blockRight: Leaf<OrderEntry>,
    leaf: Leaf<OrderEntry>,
    position1: number,
    entry1: OrderEntry,
    position2: number,
    entry2: OrderEntry
  }): {
    blockRoot: Tree<OrderEntry>,
    blockLeft: Leaf<OrderEntry>,
    blockRight: Leaf<OrderEntry>,
    leaf1: Leaf<OrderEntry>,
    gapKey1: GapKey,
    index1: number,
    leaf2: Leaf<OrderEntry>,
    gapKey2: GapKey,
    index2: number
  } {
    // there must be at least 4 spaces
    // such that when a pair is inserted
    // there's always at least 2 spaces left
    // for subsequent insertion
    if (leaf.space > 3) {
      let leafNew;
      if (!snapshot.has(leaf)) {
        leafNew = leaf.clone();
        snapshot.add(leafNew);
        treeTableT.set(leafNew.id, leafNew);
      } else {
        leafNew = leaf;
      }
      if (blockLeft === leaf) {
        blockLeft = leafNew;
      }
      if (blockRight === leaf) {
        blockRight = leafNew;
      }
      if (blockRoot === leaf) {
        blockRoot = leafNew;
      }
      const [[gapKey1, index1], [gapKey2, index2]] = leafNew.caretPair(
        updateNodeLink,
        position1,
        entry1,
        position2,
        entry2
      );
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

      // inserting in the middle center should be based on the count split

      const indexCenter = leaf.children.count / 2;
      let leafLeft, leafRight;
      if (!snapshot.has(leaf)) {
        leafLeft = leaf.clone();
        snapshot.add(leafLeft);
        treeTableT.set(leafLeft.id, leafLeft);
        if (blockLeft === leaf) {
          blockLeft = leafLeft;
        }
      } else {
        leafLeft = leaf;
      }
      const [[, indexSplit1], [, indexSplit2]] = leafLeft.caretPair(
        updateNodeLink,
        position1,
        entry1,
        position2,
        entry2
      );
      [leafLeft, leafRight] = leafLeft.split(updateNodeLink, counterT.allocate());
      snapshot.add(leafRight);
      treeTableT.set(leafRight.id, leafRight);
      // it's now leafRight
      if (blockRight === leaf) {
        blockRight = leafRight;
      }
      if (leafRight.nextId != null) {
        const leafRightRight = treeTableT.get(leafRight.nextId);
        if (leafRightRight instanceof Node) throw new Error('leafRightRight must be a Leaf');
        let leafRightRightNew;
        if (!snapshot.has(leafRightRight)) {
          leafRightRightNew = leafRightRight.clone();
          snapshot.add(leafRightRightNew);
          treeTableT.set(leafRightRightNew.id, leafRightRightNew);
          if (blockRight === leafRightRight) {
            blockRight = leafRightRightNew;
          }
        } else {
          leafRightRightNew = leafRightRight;
        }
        leafRightRightNew.prevId = leafRight.id;
      }
      // due to split, we need to correct indexSplit1 to index1 and indexSplit2 to index2
      let leafInserted1, index1, leafInserted2, index2;
      if (indexSplit1 <= indexCenter) {
        leafInserted1 = leafLeft;
        index1 = indexSplit1;
      } else {
        leafInserted1 = leafRight;
        index1 = indexSplit1 - indexCenter - 1;
      }
      if (indexSplit2 <= indexCenter) {
        leafInserted2 = leafLeft;
        index2 = indexSplit2;
      } else {
        leafInserted2 = leafRight;
        index2 = indexSplit2 - indexCenter - 1;
      }
      const gapKey1 = leafInserted1.children.get(index1).key;
      const gapKey2 = leafInserted2.children.get(index2).key;
      if (!leaf.parentLink) {
        const children = Node.prepChildren(
          [leafLeft.id, leafRight.id],
          leaf.children.length
        );
        const blockRoot = new Node(counterT.allocate(), 0, children);
        leafLeft.parentLink = {
          link: blockRoot.id,
          key: children[0].key
        };
        leafRight.parentLink = {
          link: blockRoot.id,
          key: children[1].key
        };
        treeTableT.set(blockRoot.id, blockRoot);
        return {
          blockRoot: blockRoot,
          blockLeft: leafLeft,
          blockRight: leafRight,
          leaf1: leafInserted1,
          gapKey1: gapKey1,
          index1: index1,
          leaf2: leafInserted2,
          gapKey2: gapKey2,
          index2: index2
        };
      } else {
        const updateTreeLink = (id, parentLink) => {
          if (!parentLink) return;
          const tree = treeTableT.get(id);
          if (!snaphsot.has(tree)) {
            const treeNew = tree.clone();
            treeNew.parentLink = parentLink;
            snapshot.add(treeNew);
            treeTableT.set(id, treeNew);
          } else {
            tree.parentLink = parentLink;
          }
          return;
        };
        const parentNode = treeTableT.get(leaf.parentLink.link);
        return this._insertIntoNode({
          treeTableT,
          counterT,
          snapshot,
          updateTreeLink,
          node: parentNode,
          childKey: leaf.parentLink.key,
          child: leafRight.id,
          result: {
            blockRoot,
            blockLeft,
            blockRight,
            leaf1: leafInserted1,
            gapKey1,
            index1,
            leaf2: leafInserted2,
            gapKey2,
            index2
          }
        });
      }
    }
  }

  _insertIntoNode<Result: { blockRoot: Tree<OrderEntry> }> (
    {
      treeTableT,
      counterT,
      snapshot,
      updateTreeLink,
      node,
      childKey,
      child,
      result
    }: {
      treeTableT: TreeTable,
      counterT: CounterTransaction,
      snapshot: SnapShot,
      updateTreeLink: UpdateTreeLink,
      node: Node,
      childKey: GapKey,
      child: TreeId,
      result: Result
    }
  ): Result {
    if (node.space > 1) {
      let nodeNew;
      if (!snapshot.has(node)) {
        nodeNew = node.clone();
        snapshot.add(nodeNew);
        treeTableT.set(nodeNew.id, nodeNew);
        if (result.blockRoot === node) {
          result.blockRoot = nodeNew;
        }
      } else {
        nodeNew = node;
      }
      const [position] = interpolationSearch(
        childKey,
        nodeNew.children.count,
        (index) => nodeNew.children.get(index).key
      );
      if (position == null) {
        throw new Error('Missing existing child gap key');
      }
      nodeNew.caret(updateTreeLink, position + 1, newId);
      return result;
    } else {
      let nodeLeft, nodeRight;
      if (!snapshot.has(node)) {
        nodeLeft = node.clone();
        snapshot.add(nodeLeft);
        treeTableT.set(nodeLeft.id, nodeLeft);
      } else {
        nodeLeft = node;
      }
      const [position] = interpolationSearch(
        childKey,
        nodeLeft.children.count,
        (index) => nodeLeft.children.get(index).key
      );
      if (position == null) {
        throw new Error('Missing existing child gap key');
      }
      nodeLeft.caret(updateTreeLink, position + 1, newId);
      [nodeLeft, nodeRight] = nodeLeft.split(counterT.allocate());
      snapshot.add(nodeRight);
      treeTableT.set(nodeRight.id, nodeRight);
      if (!node.parentLink) {
        const children = Node.prepChildren(
          [nodeLeft.id, nodeRight.id],
          node.children.length
        );
        const blockRoot = new Node(counterT.allocate(), 0, children);
        nodeLeft.parentLink = {
          link: blockRoot.id,
          key: children[0].key
        };
        nodeRight.parentLink = {
          link: blockRoot.id,
          key: children[1].key
        };
        snapshot.add(blockRoot);
        treeTableT.set(blockRoot.id, blockRoot);
        result.blockRoot = blockRoot;
        return result;
      } else {
        const parentNode = treeTableT.get(node.parentLink.link);
        return this._insertIntoNode({
          treeTableT,
          counterT,
          snapshot,
          updateTreeLink,
          node: parentNode,
          childKey: node.parentLink.key,
          child: nodeRight.id,
          result
        });
      }
    }
  }

  // compare 2 cursors
  // it only makes sense to compare 2 cursors that are within the same tree?
  /*
   * isBeforeCursor (cursor1: Cursor, cursor2: Cursor): boolean {
   *   const leaf1 = cursor1.getLeaf();
   *   const leaf2 = cursor2.getLeaf();
   *   if (leaf1 === leaf2) {
   *     return cursor1.getIndex() < cursor2.getIndex();
   *   } else {
   *     const [lca, child1, child2] = leastCommonAncestor(
   *       leaf1,
   *       leaf2,
   *       (block) => {
   *         return block.getParent();
   *       }
   *     );
   *     let childIndex1, childIndex2;
   *     const children = lca.getChildren();
   *     for (let i = 0; i < children.length; ++i) {
   *       const child = children[i];
   *       if (child === child1) {
   *         childIndex1 = i;
   *       } else if (child === child2) {
   *         childIndex2 = i;
   *       }
   *       if (childIndex1 != null && childIndex2 != null) {
   *         break;
   *       }
   *     }
   *     if (childIndex1 == null || !childIndex2 == null) {
   *       throw new InternalError('leastCommonAncestor returned an ancestor that did not contain the returned children!');
   *     }
   *     return childIndex1 < childIndex2;
   *   }
   * }
   * */

}

export default BOITree;
