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

import type { Tree, TreeId } from './Tree.js';
import type { LinkOpen, LinkClose } from './Links.js';

import { CounterImmutable } from 'resource-counter';
import { Map as MapI } from 'immutable';
import { ArrayFixedDense } from 'array-fixed';
import { Leaf, Node } from './Tree.js';
import { interpolationSearch, nestContexts } from '../utilities.js';

type GapKey = number;
type SnapShot = WeakSet<Tree<OrderEntry>>;
type TreeTable = MapI<TreeId, Tree<OrderEntry>>;

// a cursor is an abstraction over the entire system
// remember that means we keep the entire BOITree reference here!
// it also means we can define things like next and previous on these cursor type itself
// but i'm not sure
// also this requires us to have access to the system..
// perhaps we can then define a sort of friend class
// instead of an extension
// the idea is that it can access orderIndex directly

class Cursor<data> implements OrderCursorI {

  _orderIndex: BOITree<data>;
  _leaf: Leaf<OrderEntry>;
  _index: number;

  constructor (orderIndex, leaf, index) {
    this._orderIndex = orderIndex;
    this._leaf = leaf;
    this._index = index;
  }

  next (): { done: false, value: OrderEntry } | { done: true } {
    if (this._index < (this._leaf.children.count - 1)) {
      this._index += 1;
      return {
        done: false,
        value: this._leaf.children.get(this._index)[1]
      };
    } else if (this._leaf.nextId != null) {
      const leafNext = this._orderIndex._treeTable.get(this._leaf.nextId);
      const value = leafNext.children.get(0);
      if (value) {
        this._leaf = leafNext;
        this._index = 0;
        return {
          done: false,
          value: value[1]
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
        value: this._leaf.children.get(this._index)[1]
      };
    } else if (this._leaf.prevId != null) {
      const leafPrev = this._orderIndex._treeTable.get(this._leaf.prevId);
      const value = leafPrev.children.get(leafPrev.children.count - 1);
      if (value) {
        this._leaf = leafPrev;
        this._index = leafPrev.children.count - 1;
        return {
          done: false,
          value: value[1]
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
      (index) => leaf.children.get(index)[0]
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
      (index) => leaf.children.get(index)[0]
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
    return this._leaf.children.get(this._index)[1];
  }

  toLink (): LinkOpen|LinkClose {
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

class BOITree<data: *> implements OrderIndexI<LinkOpen, LinkClose, data> {

  _blockSize: number;
  _nodeTable: NodeTableI<LinkOpen, LinkClose, data>;
  _treeTable: TreeTable;
  _counter: CounterImmutable;
  _rootId: TreeId;
  _leftId: TreeId;
  _rightId: TreeId;

  constructor (
    config: ConstructConfig<LinkOpen, LinkClose, data>
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
  ): OrderIndexI<Cursor, LinkOpen, LinkClose, data> {
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
    OrderIndexI<Cursor, LinkOpen, LinkClose, data>
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
          NodeTableTransaction<LinkOpen, LinkClose, data>,
          TreeTable,
          CounterTransaction
        ]
      ) => {
        const updateLink = (id, openLinkUpdated, closeLinkUpdated) => {
          if (!openLinkUpdated && !closeLinkUpdated) return;
          const updatedNode = nodeTableT.updateNode(
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
            const rootNode = nodeTableT.getNode(rootOpenEntry[1].id);
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
            updateLink,
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
          const rootNode = nodeTableT.getNode(rootOpenEntry[1].id);
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
            updateLink,
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
            updateLink,
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
    OrderIndexI<Cursor, LinkOpen, LinkClose, data>
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
          NodeTableTransaction<LinkOpen, LinkClose, data>,
          TreeTable,
          CounterTransaction
        ]
      ) => {
        const updateLink = (id, openLinkUpdated, closeLinkUpdated) => {
          if (!openLinkUpdated && !closeLinkUpdated) return;
          const updatedNode = nodeTableT.updateNode(
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
          updateLink,
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

  // links is an internal thing
  // well not really the nodetable
  // so something mediates access to the nodetable?
  // and you can insert things there?
  // no, because this is mediating access
  // so when they do, they don't directly access the links
  // they shouldn't be doing so
  // so this is an internal function
  // something else acquires the cursor
  // just directly from having the node
  // so the node is where we have this information!
  // they can then pass the node in to acquire the OrderCursorI
  // but this requires to pass the links

  _getCursorOpen (link: LinkOpen): OrderCursorI {
    const leaf = this._treeTable.get(link.leafOpenId);
    const [index] = interpolationSearch(
      link.gapKeyOpen,
      leaf.children.count,
      (index) => leaf.children.get(index)[0]
    );
    return new Cursor(this, leaf, index);
  }

  _getCursorClose (link: LinkClose): OrderCursorI {
    const leaf = this._treeTable.get(link.leafCloseId);
    const [index] = interpolationSearch(
      link.gapKeyClose,
      leaf.children.count,
      (index) => leaf.children.get(index)[0]
    );
    return new Cursor(this, leaf, index);
  }




  /* findCursor (link: GapLink<Leaf>): ?Cursor {
   *   const children = link.block.children;
   *   const [index, cost] = interpolationSearch(
   *     link.key,
   *     children.count,
   *     (index) => children.get(index)[0];
   *   );
   *   if (cost > Math.log2(children.count)) {
   *     this.relabelGapKeys();
   *   }
   *   if (index != null) {
   *     return new Cursor(link.block, index);
   *   }
   *   return null;
   * }

   * getLink (cursor: CursorEntry): GapLink {
   *   const children = cursor.leaf.children;
   *   const child = children.get(cursor.index);
   *   if (child) return new GapLink(cursor.leaf, child[0]);
   *   throw new Error('Invalid cursor');
   * }

   * getCursorOpen (cursorClose: Cursor): Cursor {
   *   const entry = this.getEntry(cursorClose);
   *   if (entry.status) {
   *     throw new Error('Must be a closing cursor');
   *   }
   *   const node = this._nodeTable.getNodeById(entry.id);
   *   if (node && node.opening) {
   *     const cursorOpen = this.findCursor(node.opening);
   *     if (cursorOpen) return cursorOpen;
   *     throw new Error('Invalid cursor pair');
   *   }
   *   throw new Error('Unknown cursor');
   * }

   * getCursorClose (cursorOpen: Cursor): Cursor {
   *   const entry = this.getEntry(cursorOpen);
   *   if (!entry.status) {
   *     throw new Error('Must be a opening cursor');
   *   }
   *   const node = this._nodeTable.getNodeById(entry.id);
   *   if (node && node.closing) {
   *     const cursorClose = this.findCursor(node.closing);
   *     if (cursorClose) return cursorClose;
   *     throw new Error('Invalid cursor pair');
   *   }
   *   throw new Error('Unknown cursor');
   * }

   * nextCursor (cursor: Cursor): ?Cursor {
   *   const leaf = cursor.getLeaf();
   *   let indexNext = cursor.getIndex() + 1;
   *   if (leaf.getChildByIndex(indexNext)) {
   *     return new Cursor(leaf, indexNext);
   *   } else {
   *     let leafNext = leaf.getLeafNext();
   *     while (leafNext) {
   *       indexNext = 0;
   *       if (leafNext.getChildByIndex(indexNext)) {
   *         return new Cursor(leafNext, indexNext);
   *       }
   *       leafNext = leafNext.getLeafNext();
   *     }
   *   }
   *   return null;
   * }

   * prevCursor (cursor: Cursor): ?Cursor {
   *   const leaf = cursor.getLeaf();
   *   let indexPrev = cursor.getIndex() - 1;
   *   if (leaf.getChildByIndex(indexPrev)) {
   *     return new Cursor(leaf, indexPrev);
   *   } else {
   *     let leafPrev = leaf.getLeafPrev();
   *     while (leafPrev) {
   *       indexPrev = leafPrev.getChildrenLength() - 1;
   *       if (leafPrev.getChildByIndex(indexPrev)) {
   *         return new Cursor(leafPrev, indexPrev);
   *       }
   *       leafPrev = leafPrev.getLeafPrev();
   *     }
   *   }
   *   return null;
   * }

   * nextCursorOpen (cursor: Cursor): ?Cursor {
   *   const nextCursor = this.nextCursor(cursor);
   *   if (!nextCursor) return null;
   *   if (this.getEntry(nextCursor).status) {
   *     return nextCursor;
   *   } else {
   *     return this.nextCursorOpen(nextCursor);
   *   }
   * }

   * prevCursorOpen (cursor: Cursor): ?Cursor {
   *   const prevCursor = this.prevCursor(cursor);
   *   if (!prevCursor) return null;
   *   if (this.getEntry(prevCursor).status) {
   *     return prevCursor;
   *   } else {
   *     return this.prevCursorOpen(prevCursor);
   *   }
   * }

   * nextCursorClose (cursor: Cursor): ?Cursor {
   *   const nextCursor = this.nextCursor(cursor);
   *   if (!nextCursor) return null;
   *   if (!this.getEntry(nextCursor).status) {
   *     return nextCursor;
   *   } else {
   *     return this.nextCursorClose(nextCursor);
   *   }
   * }

   * prevCursorClose (cursor: Cursor): ?Cursor {
   *   const prevCursor = this.prevCursor(cursor);
   *   if (!prevCursor) return null;
   *   if (!this.getEntry(prevCursor).status) {
   *     return prevCursor;
   *   } else {
   *     return this.prevCursorClose(prevCursor);
   *   }
   * }

   * nextSiblingCursors (cursor: Cursor): ?[Cursor, Cursor] {
   *   const entry = this.getEntry(cursor);
   *   if (entry.status) cursor = this.getCursorClose(cursor);
   *   const siblingCursor = this.nextCursor(cursor);
   *   if (!siblingCursor || !this.getEntry(siblingCursor).status) {
   *     return null;
   *   }
   *   return [siblingCursor, this.getCursorClose(siblingCursor)];
   * }

   * prevSiblingCursors (cursor: Cursor): ?[Cursor, Cursor] {
   *   const entry = this.getEntry(cursor);
   *   if (!entry.status) cursor = this.getCursorOpen(cursor);
   *   const siblingCursor = this.prevCursor(cursor);
   *   if (!siblingCursor || this.getEntry(siblingCursor).status) {
   *     return null;
   *   }
   *   return [this.getCursorOpen(siblingCursor), siblingCursor];
   * }

   * insertEntryPairRoot (
   *   [entryOpen, entryClose]: [OrderEntry, OrderEntry]
   * ): [Cursor, Cursor] {
   *   const leafFirst = this._root.getLeafFirst();
   *   const leafLast = this._root.getLeafLast();
   *   const [, leafFirstNew, indexFirst] = leafFirst.insertEntry(entryOpen, 0);
   *   const [, leafLastNew, indexLast] = leafLast.insertEntry(entryClose, -1);
   *   return [
   *     new Cursor(leafFirstNew, keyFirst),
   *     new Cursor(leafLastNew, keyLast)
   *   ];
   * }

   * insertEntryPairChild (
   *   [entryOpen, entryClose]: [OrderEntry, OrderEntry]
   *   [parentCursorOpen, parentCursorClose, position]: [Cursor, Cursor, number]
   * ): [Cursor, Cursor] {
   *   let cursorTarget;
   *   if (position >= 0) {
   *     cursorTarget = this.nextCursor(parentCursorOpen),
   *   } else {
   *     cursorTarget = this.prevCursor(parentCursorClose),
   *   }
   *   if (
   *     cursorTarget === parentCursorClose ||
   *     cursorTarget === parentCursorOpen
   *   ) {
   *     const [, leafOpen, indexOpen] = parentCursorOpen.getLeaf().insertEntry(
   *       entryOpen,
   *       parentCursorOpen.getIndex() + 1
   *     );
   *     const [, leafClose, indexClose] = leafOpen.insertEntry(
   *       entryClose,
   *       indexOpen + 1
   *     );
   *     return [new Cursor(leafOpen, indexOpen), new Cursor(leafClose, indexClose)];
   *   }
   *   if (position >= 0) {
   *     while (position > 0) {
   *       --position;
   *       const siblingCursors = this.nextSiblingCursors(cursorTarget);
   *       if (!siblingCursors) break;
   *       [, cursorTarget] = siblingCursors;
   *     }
   *   } else {
   *     while (position < -1) {
   *       ++position;
   *       const siblingCursors = this.prevSiblingCursors(cursorTarget);
   *       if (!siblingCursors) break;
   *       [cursorTarget] = siblingCursors;
   *     }
   *   }
   *   return this.insertEntryPairSibling([entryOpen, entryClose], cursorTarget);
   * }


   * // who does the update and relabelling of the gapkeys work?
   * // consider that the node table is being passed into each leaf
   * // this is pretty dumb
   * // it should be the botree that is doing that
   * // but if the leaf is the one doing the insertion
   * // only it knows about the fact that the data needs to be relabelled
   * // unless we expose that each leaf is just an POJO
   * // then the insertEntry is where we define this functionality
   * // it'd be part of a private method
   * // there's 2 parts to this
   * // WHO UPDATES THE NODE TABLE to update the link after entry
   * // and WHO UPDATES THE NODE TABLE for relabelling
   * // the ideal is for the BOTree itself to have a nodetable link
   * // and perform the update link and relabelling procedure itself
   * // but then we what we are saying is that the function for insertion into a leaf is performed here and not in the leaf itself
   * // maybe that's what we need to do, thus making a leaf a sort of POJO
   * // this means we have insertEntry (orderEntry, leaf, position)
   * // note that position is translated from the cursor
   * // but why not instead _insertEntry(orderEntry, cursor)
   * // because this is a low level function that is just the leaf and position number
   * // anyway that means we can shift out the notion of updating link and relabelling here
   * // instead
   * // and also we need to access the data directly

   * insertEntryPairSibling (
   *   [entryOpen, entryClose]: [OrderEntry, OrderEntry],
   *   siblingCursor: Cursor
   * ): [Cursor, Cursor] {

   *   const entry = this.getEntry(siblingCursor);

   *   if (entry.status) {
   *     // insert on the left


   *   } else {
   *     // insert on the right


   *   }
   * }

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

   * adjustLevel (cursor: Cursor) {

   * }

   * [Symbol.iterator] (): Iterator<Cursor> {
   *   let leaf = this._root.getFirstLeaf();
   *   let leafIterator = (leaf) ? leaf[Symbol.iterator]() : null;
   *   const next = () => {
   *     if (leaf && leafIterator) {
   *       const { value } = leafIterator.next();
   *       if (value) {
   *         const [index, keyEntry] = value;
   *         if (keyEntry) {
   *           return {
   *             done: false,
   *             value: new Cursor(leaf, index);
   *           }
   *         }
   *       }
   *       leaf = leaf.getNextLeaf();
   *       leafIterator = (leaf) ? leaf[Symbol.iterator]() : null;
   *       return next();
   *     } else {
   *       return {
   *         done: true,
   *         value: undefined
   *       }
   *     }
   *   };
   *   return {
   *     next: next
   *   };
   * }*/

  _insertIntoLeaf ({
    nodeTableT,
    treeTableT,
    counterT,
    snapshot,
    updateLink,
    blockRoot,
    blockLeft,
    blockRight,
    leaf,
    position,
    entry
  }: {
    nodeTableT: NodeTableTransaction<LinkOpen, LinkClose, data>,
    treeTableT: TreeTable,
    counterT: CounterTransaction,
    snapshot: SnapShot,
    updateLink: (NodeId, ?LinkOpen, ?LinkClose) => any,
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
      const [gapKey, index] = leafNew.caret(updateLink, position, entry);
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
      const [, indexSplit] = leafLeft.caret(updateLink, position, entry);
      [leafLeft, leafRight] = leafLeft.split(updateLink, counterT.allocate());
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
      const [gapKey] = leafInserted.children.get(index);
      if (!leaf.parentId) {
        const children = [leafLeft.id, leafRight.id];
        children.length = leaf.children.length;
        const blockRoot = new Node(
          counterT.allocate(),
          0,
          ArrayFixedDense.fromArray(children, 2, true)
        );
        leafLeft.parentId = blockRoot.id;
        leafRight.parentId = blockRoot.id;
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
        const parentNode = treeTableT.get(leaf.parentId);
        // $FlowFixMe: parentNode is a Node
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
    updateLink,
    blockRoot,
    blockLeft,
    blockRight,
    leaf,
    position1,
    entry1,
    position2,
    entry2
  }: {
    nodeTableT: NodeTableTransaction<LinkOpen, LinkClose, data>,
    treeTableT: TreeTable,
    counterT: CounterTransaction,
    snapshot: SnapShot,
    updateLink: (NodeId, ?LinkOpen, ?LinkClose) => any,
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
        updateLink,
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
        updateLink,
        position1,
        entry1,
        position2,
        entry2
      );
      [leafLeft, leafRight] = leafLeft.split(updateLink, counterT.allocate());
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
      const [gapKey1] = leafInserted1.children.get(index1);
      const [gapKey2] = leafInserted2.children.get(index2);
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
        const parentNode = treeTableT.get(leaf.parentId);
        // $FlowFixMe: parentNode is a Node
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

  _insertIntoNode<Result: { blockRoot: Tree<OrderEntry> }> (
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
        treeTableT.set(nodeNew.id, nodeNew);
        if (result.blockRoot === node) {
          result.blockRoot = nodeNew;
        }
      } else {
        nodeNew = node;
      }
      const position = nodeNew.children.findIndex((id) => id === existingId);
      if (position < 0) {
        throw new Error('Missing existing child id');
      }
      nodeNew.caret(position + 1, newId);
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
      const position = nodeLeft.children.findIndex((id) => id === existingId);
      if (position < 0) {
        throw new Error('Missing existing child id');
      }
      nodeLeft.caret(position + 1, newId);
      [nodeLeft, nodeRight] = nodeLeft.split(counterT.allocate());
      snapshot.add(nodeRight);
      treeTableT.set(nodeRight.id, nodeRight);
      if (!node.parentId) {
        const children = [nodeLeft.id, nodeRight.id];
        children.length = node.children.length;
        const blockRoot = new Node(
          counterT.allocate(),
          0,
          ArrayFixedDense.fromArray(children, 2, true)
        );
        nodeLeft.parentId = blockRoot.id;
        nodeRight.parentId = blockRoot.id;
        snapshot.add(blockRoot);
        treeTableT.set(blockRoot.id, blockRoot);
        result.blockRoot = blockRoot;
        return result;
      } else {
        const parentNode = treeTableT.get(node.parentId);
        // $FlowFixMe: parentNode is a Node
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

}

export default BOITree;
