// @flow

import type { ArrayFixedDense } from 'array-fixed';
import type { NodeId } from '../NodeTable.js';

import type { LinkOpen, LinkClose } from './Links.js';

import { boundIndex, generateGapKey, generateGapKeys } from '../utilities.js';

type TreeId = number;
type Tree<entry> = Leaf<entry> | Node;
type GapKey = number;

class Leaf<entry> {

  id: TreeId;
  levelDelta: number;
  children: ArrayFixedDense<[GapKey, entry]>;
  parentId: ?TreeId;
  prevId: ?TreeId;
  nextId: ?TreeId;

  constructor (
    id: TreeId,
    levelDelta: number,
    children: ArrayFixedDense<[GapKey, entry]>,
    parentId: ?TreeId,
    prevId: ?TreeId,
    nextId: ?TreeId,
    updateLink: ?((NodeId, ?LinkOpen, ?LinkClose) => any) = null
  ) {
    this.id = id;
    this.levelDelta = levelDelta;
    this.children = children;
    this.parentId = parentId;
    this.prevId = prevId;
    this.nextId = nextId;
    if (updateLink) {
      this._relabelGapKeys(updateLink);
    }
  }

  get space (): number {
    return this.children.length - this.children.count;
  }

  clone (): Leaf<entry> {
    return new Leaf(
      this.id,
      this.levelDelta,
      this.children.slice(),
      this.parentId,
      this.prevId,
      this.nextId
    );
  }

  caret (
    updateLink: (NodeId, ?LinkOpen, ?LinkClose) => any,
    position: number,
    entry_: entry
  ): [GapKey, number] {
    if (this.space < 1) {
      throw new Error('Not enough space to caret in 1 entry');
    }
    // position is bound relative to the length
    position = boundIndex(position, this.children.length - 1);
    let needsRelabelling = false;
    let gapKey;
    // this work seven when position is pass the count
    gapKey = this._generateGapKey(position);
    if (gapKey == null) {
      needsRelabelling = true;
      gapKey = 0;
    }
    // position is corrected to the exact index of insertion
    position = this.children.caretRight(position, [gapKey, entry_]);
    if (needsRelabelling) {
      this._relabelGapKeys(updateLink);
      [gapKey] = this.children.get(position);
    }
    return [gapKey, position];
  }

  caretPair (
    updateLink: (NodeId, ?LinkOpen, ?LinkClose) => any,
    position1: number,
    entry1: entry,
    position2: number,
    entry2: entry
  ): [[GapKey, number], [GapKey, number]] {
    if (this.space < 2) {
      throw new Error('Not enough space to caret in 2 entries');
    }
    // position1 and position2 is bound relative to the length
    position1 = boundIndex(position1, this.children.length - 1);
    position2 = boundIndex(position2, this.children.length - 1);
    if (position1 >= position2 ) {
      throw new Error('Pair positions must be in order and unique');
    }
    let needsRelabelling = false;
    let gapKey1;
    gapKey1 = this._generateGapKey(position1);
    if (gapKey1 == null) {
      needsRelabelling = true;
      gapKey1 = 0;
    }
    // position1 is corrected to the exact index of insertion
    position1 = this.children.caretRight(position1, [gapKey1, entry1]);
    let gapKey2;
    gapKey2 = this._generateGapKey(position2);
    if (gapKey2 == null) {
      needsRelabelling = true;
      gapKey2 = 0;
    }
    // position2 is corrected to the exact index of insertion
    position2 = this.children.caretRight(position2, [gapKey2, entry2]);
    if (needsRelabelling) {
      this._relabelGapKeys(updateLink);
      [gapKey1] = this.children.get(position1);
      [gapKey2] = this.children.get(position2);
    }
    return [[gapKey1, position1], [gapKey2, position2]];
  }

  split (
    updateLink: (NodeId, ?LinkOpen, ?LinkClose) => any,
    idNew: TreeId,
    index?: number
  ): [Leaf<entry>, Leaf<entry>] {
    if (index === undefined) {
      index = Math.ceil(this.children.count / 2);
    }
    const childrenLeft = this.children.slice(0, index);
    const childrenRight = this.children.slice(index);
    childrenLeft.length = this.children.length;
    childrenRight.length = this.children.length;
    this.children = childrenLeft;
    const leafLeft = this;
    const leafRight = new Leaf(
      idNew,
      this.levelDelta,
      childrenRight,
      this.parentId,
      leafLeft.id,
      leafLeft.nextId,
      updateLink
    );
    leafLeft.nextId = idNew;
    return [
      leafLeft,
      leafRight
    ];
  }

  _generateGapKey (index: number): ?GapKey {
    let childPrev, childNext, childLast;
    childNext = this.children.get(index);
    if ((index - 1) >= 0) childPrev = this.children.get(index - 1);
    if (this.children.count) childLast = this.children.get(this.children.count - 1);
    let gapKey;
    if (childPrev && childNext) {
      // careting between entries
      gapKey = generateGapKey(this.children.length, childPrev[0], childNext[0]);
    } else if (childPrev) {
      // careting at the end
      gapKey = generateGapKey(this.children.length, childPrev[0]);
    } else if (childNext) {
      // careting at the start
      gapKey = generateGapKey(this.children.length, null, childNext[0]);
    } else if (childLast) {
      // careting past the end
      gapKey = generateGapKey(this.children.length, childLast[0]);
    } else {
      // careting into empty array
      gapKey = generateGapKey(this.children.length);
    }
    return gapKey;
  }

  _relabelGapKeys (
    updateLink: (NodeId, ?LinkOpen, ?LinkClose) => any
  ) {
    const keys = generateGapKeys(this.children.count);
    let i = 0;
    this.children.forEach((child, index) => {
      child[0] = keys[i];
      ++i;
      // we ignore children with no id
      // they have not been filled by the NodeTable
      if (child[1].id != null) {
        if (child[1].status) {
          updateLink(
            child[1].id,
            {
              leafOpenId: this.id,
              gapKeyOpen: child[0]
            }
          );
        } else {
          updateLink(
            child[1].id,
            null,
            {
              leafCloseId: this.id,
              gapKeyClose: child[0]
            }
          );
        }
      }
    });
  }

}

class Node {

  id: TreeId;
  levelDelta: number;
  children: ArrayFixedDense<TreeId>;
  parentId: ?TreeId;

  constructor (
    id: TreeId,
    levelDelta: number,
    children: ArrayFixedDense<TreeId>,
    parentId: ?TreeId
  ) {
    this.id = id;
    this.children = children;
    this.levelDelta = levelDelta;
    this.parentId = parentId;
  }

  get space (): number {
    return this.children.length - this.children.count;
  }

  clone (): Node {
    return new Node(
      this.id,
      this.levelDelta,
      this.children.slice(),
      this.parentId
    );
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
      index = Math.ceil(this.children.count / 2);
    }
    const childrenLeft = this.children.slice(0, index);
    const childrenRight = this.children.slice(index);
    childrenLeft.length = this.children.length;
    childrenRight.length = this.children.length;
    this.children = childrenLeft;
    const nodeLeft = this;
    const nodeRight = new Node(
      idNew,
      this.levelDelta,
      childrenRight,
      this.parentId
    );
    return [
      nodeLeft,
      nodeRight
    ];
  }

}

export { Leaf, Node };

export type { Tree, TreeId };
