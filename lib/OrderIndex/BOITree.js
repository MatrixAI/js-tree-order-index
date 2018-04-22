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
import Cursor from './BOITreeCursor.js';
import { interpolationSearch, nestContexts } from '../utilities.js';

type GapKey = number;
type SnapShot = WeakSet<Tree<OrderEntry>>;
type TreeTable = MapI<TreeId, Tree<OrderEntry>>;

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
            leafOpen: leafOpen.id,
            gapKeyOpen
          };
          closeLink = {
            leafClose: leafClose.id,
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
            leafOpen: leafOpen.id,
            gapKeyOpen
          };
          closeLink = {
            leafClose: leafClose.id,
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

  insertParent (
    childNodeId: NodeId,
    data_: data
  ): [
    NodeId,
    OrderIndexI<Cursor, TableLinkOpen, TableLinkClose, data>
  ] {
    const childNode = this._nodeTable.getNode(childNodeId);
    if (!childNode) {
      throw new Error('Unknown child node id');
    }
    const cursorOpen = this._getCursorOpen(childNode);
    const cursorClose = this._getCursorClose(childNode);
    const leaf1 = cursorOpen.leaf;
    const leaf2 = cursorClose.leaf;
    let position1, position2;
    // if the cursors are on the same leaf
    // then the closing link of the new parent
    // needs to be incremented by 1
    if (leaf1 === leaf2) {
      position1 = cursorOpen.index;
      position2 = cursorClose.index + 2;
    } else {
      position1 = cursorOpen.index;
      position2 = cursorClose.index + 1;
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
        let blockRoot, blockLeft, blockRight;
        let leafOpen, gapKeyOpen, leafClose, gapKeyClose;
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
        if (leaf1 === leaf2) {
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
            leaf1,
            position1,
            entry1: entryOpen,
            position2,
            entry2: entryClose
          }));
        } else {
          ({
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
            updateNodeLink,
            blockRoot,
            blockLeft,
            blockRight,
            leaf: leaf1,
            position: position1,
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
            leaf: leaf2,
            position: position2,
            entry: entryClose
          }));
        }
        const openLink = {
          leafOpen: leafOpen.id,
          gapKeyOpen
        };
        const closeLink = {
          leafClose: leafClose.id,
          gapKeyClose
        };
        cloneConfig.rootId = blockRoot.id;
        cloneConfig.leftId = blockLeft.id;
        cloneConfig.rightId = blockRight.id;

        // the new parent
        // inherits the child's level
        // because it is now at the position where the child used to be
        // instead the child must have its level adjusted

        // we have several issues here
        // this is not as simple as the other ones
        // because this is equivalent to relocation
        // we are relocating the entire child subtree
        // under a new child that is at the same position as the old child node
        // this means the levels of the entire subtree needs to be updated
        // the way to do this efficiently
        // is to do it lazily
        // that is there must be some block system that allows
        // to store the levelDelta into the block system
        // but it must be done carefully
        // since the new parent
        // may exist along with several other nodes
        // that don't need its level to be updated

        // one thing that the subtree relocation does
        // is that when it crops out the subtree
        // the subtree's new block level starts out as 0
        // and it gets added the delta between the old parent
        // and the target parent
        // if the old parent has a level of 0
        // and the new parent is 1 extra
        // then the root of the subtree gets +1 do the block level

        // block levels get adjusted
        // when blocks are being merged
        // for a LEAF merge
        // the block is disappearing gets merged into the target block
        // opening links in the from block
        // gets updated by their NT.level + FROM.level - TO.LEVEL
        // for a NODE merge
        // it's different
        // then it's the child block levels that get adjusted
        // remember the TO block doesn't get affected
        // so existing children on the TO block doesn't change (including child blocks)
        // but child blocks in the FROM block
        // gets adjusted by FROM.level - TO.level

        // it's not that simple
        // to insert the parent
        // you need to crop out the entire child range
        // rooted at the child node
        // because it requires its own block level adjustment at the top
        // ok so you crop out the range first
        // we'll need to access not insertion functions
        // but block splitting functions directly
        // once we have the subtree
        // we can +1 to the subtree's root block
        // and then do the splitting
        // of the original tree
        // and then splice into the original tree
        // creating a new root if necessary
        // so it's a bit funny since what you need to do is to keep the links
        // but insert a new node for them
        // but you need to keep that node as well

        // insert parent is basically subtree relocation
        // it's more complicated!

        nodeInsertedId = nodeTableT.insertNode(
          childNode.level_,
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
    let position1;
    let position2;
    // direction true means inserting with positive indicies
    // this means we start from the left, and caret on the right
    // direction false means inserting with negative indicies
    // this means we start from the right, and caret on the left
    if (direction) {
      position1 = cursor.index + 1;
      position2 = position1 + 1;
    } else {
      position1 = cursor.index;
      position2 = position1 + 1;
    }
    const leaf = cursor.leaf;
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
          leafOpen: leafOpen.id,
          gapKeyOpen
        };
        const closeLink = {
          leafClose: leafClose.id,
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

  insertSibling (
    siblingNodeId: NodeId,
    direction: boolean,
    data_: data
  ): [
    NodeId,
    OrderIndexI<Cursor, TableLinkOpen, TableLinkClose, data>
  ] {
    const siblingNode = this._nodeTable.getNode(siblingNodeId);
    if (!siblingNode) {
      throw new Error('Unknown sibling node id');
    }
    let cursor;
    let position1, position2;
    // direction true means caret on the left
    // direction false means caret on the right right
    // but that's not what is there
    if (direction) {
      cursor = this._getCursorOpen(siblingNode);
      if (
        (cursor.leaf.id === this._leftId) &&
        (cursor.index === 0)
      ) {
        throw new Error('Cannot insert sibling node to the root node');
      }
      position1 = cursor.index;
      position2 = position1 + 1;
    } else {
      cursor = this._getCursorClose(siblingNode);
      if (
        (cursor.leaf.id === this._rightId) &&
        (cursor.index === (cursor.leaf.children.count - 1))
      ) {
        throw new Error('Cannot insert sibling node to the root node');
      }
      position1 = cursor.index + 1;
      position2 = position1 + 1;
    }
    const leaf = cursor.leaf;
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
          leafOpen: leafOpen.id,
          gapKeyOpen
        };
        const closeLink = {
          leafClose: leafClose.id,
          gapKeyClose
        };
        cloneConfig.rootId = blockRoot.id;
        cloneConfig.leftId = blockLeft.id;
        cloneConfig.rightId = blockRight.id;
        nodeInsertedId = nodeTableT.insertNode(
          siblingNode.level_,
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
    const leaf = this._treeTable.get(link.leafOpen);
    const [index] = interpolationSearch(
      link.gapKeyOpen,
      leaf.children.count,
      (index) => leaf.children.get(index).key
    );
    return new Cursor(this, leaf, index);
  }

  _getCursorClose (link: TableLinkClose): OrderCursorI {
    const leaf = this._treeTable.get(link.leafClose);
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
          key: children.get(0).key
        };
        leafRight.parentLink = {
          link: blockRoot.id,
          key: children.get(1).key
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
          if (!snapshot.has(tree)) {
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
          key: children.get(0).key
        };
        leafRight.parentLink = {
          link: blockRoot.id,
          key: children.get(1).key
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
          if (!snapshot.has(tree)) {
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
      nodeNew.caret(
        updateTreeLink,
        position + 1,
        child
      );
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
      nodeLeft.caret(updateTreeLink, position + 1, child);
      [nodeLeft, nodeRight] = nodeLeft.split(updateTreeLink, counterT.allocate());
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
          key: children.get(0).key
        };
        nodeRight.parentLink = {
          link: blockRoot.id,
          key: children.get(1).key
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
