// @flow

import type { NodeId } from '../NodeTable.js';
import type { GapLink, TableLinkOpen, TableLinkClose } from './Links.js';

import { ArrayFixedDense } from 'array-fixed';
import { boundIndex, generateGapKey, generateGapKeys } from '../utilities.js';

type Tree<entry> = Leaf<entry> | Node;
type TreeId = number;

type GapKey = number;
type UpdateNodeLink = (NodeId, ?TableLinkOpen, ?TableLinkClose) => any;
type UpdateTreeLink = (TreeId, ?GapLink<TreeId, GapKey>) => any;

class Leaf<entry> {

  id: TreeId;
  levelDelta: number;
  children: ArrayFixedDense<GapLink<entry, GapKey>>;
  parentLink: ?GapLink<TreeId, GapKey>;
  prevId: ?TreeId;
  nextId: ?TreeId;

  constructor (
    id: TreeId,
    levelDelta: number,
    children: ArrayFixedDense<GapLink<entry, GapKey>>,
    parentLink: ?GapLink<TreeId, GapKey>,
    prevId: ?TreeId,
    nextId: ?TreeId,
    updateLink: ?UpdateNodeLink
  ) {
    this.id = id;
    this.levelDelta = levelDelta;
    this.children = children;
    this.parentLink = parentLink;
    this.prevId = prevId;
    this.nextId = nextId;
    if (updateLink) {
      this._relabelGapKeys(updateLink);
    }
  }

  static prepChildren (
    entries: Array<entry>,
    blockLength: number
  ): ArrayFixedDense<GapLink<TreeId, GapKey>> {
    const keys = generateGapKeys(entries.length);
    const children = entries.map((entry, index) => ({
      link: entry,
      key: keys[index]
    }));
    children.length = blockLength;
    return ArrayFixedDense.fromArray(children, entries.length, true);
  }

  get space (): number {
    return this.children.length - this.children.count;
  }

  clone (): Leaf<entry> {
    return new Leaf(
      this.id,
      this.levelDelta,
      this.children.slice(),
      this.parentLink,
      this.prevId,
      this.nextId
    );
  }

  caret (
    updateLink: UpdateNodeLink,
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
    position = this.children.caretRight(
      position,
      {
        link: entry_,
        key: gapKey
      }
    );
    if (needsRelabelling) {
      this._relabelGapKeys(updateLink);
      gapKey = this.children.get(position).key;
    }
    return [gapKey, position];
  }

  caretPair (
    updateLink: UpdateNodeLink,
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
    position1 = this.children.caretRight(
      position1,
      {
        link: entry1,
        key: gapKey1
      }
    );
    let gapKey2;
    gapKey2 = this._generateGapKey(position2);
    if (gapKey2 == null) {
      needsRelabelling = true;
      gapKey2 = 0;
    }
    // position2 is corrected to the exact index of insertion
    position2 = this.children.caretRight(
      position2,
      {
        link: entry2,
        key: gapKey2
      }
    );
    if (needsRelabelling) {
      this._relabelGapKeys(updateLink);
      gapKey1 = this.children.get(position1).key;
      gapKey2 = this.children.get(position2).key;
    }
    return [[gapKey1, position1], [gapKey2, position2]];
  }

  split (
    updateLink: UpdateNodeLink,
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
      this.parentLink,
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
      gapKey = generateGapKey(this.children.length, childPrev.key, childNext.key);
    } else if (childPrev) {
      // careting at the end
      gapKey = generateGapKey(this.children.length, childPrev.key);
    } else if (childNext) {
      // careting at the start
      gapKey = generateGapKey(this.children.length, null, childNext.key);
    } else if (childLast) {
      // careting past the end
      gapKey = generateGapKey(this.children.length, childLast.key);
    } else {
      // careting into empty array
      gapKey = generateGapKey(this.children.length);
    }
    return gapKey;
  }

  _relabelGapKeys (updateLink: UpdateNodeLink) {
    const keys = generateGapKeys(this.children.count);
    this.children.forEach((child, index) => {
      child.key = keys[index];
      // we ignore children with no id
      // they have not been filled by the NodeTable
      if (child.link.id != null) {
        if (child.link.status) {
          updateLink(
            child.link.id,
            {
              leafOpen: this.id,
              gapKeyOpen: child.key
            }
          );
        } else {
          updateLink(
            child.link.id,
            null,
            {
              leafClose: this.id,
              gapKeyClose: child.key
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
  children: ArrayFixedDense<GapLink<TreeId, GapKey>>;
  parentLink: ?GapLink<TreeId, GapKey>;

  constructor (
    id: TreeId,
    levelDelta: number,
    children: ArrayFixedDense<GapLink<TreeId, GapKey>>,
    parentLink: ?GapLink<TreeId, GapKey>,
    updateLink: ?UpdateTreeLink
  ) {
    this.id = id;
    this.children = children;
    this.levelDelta = levelDelta;
    this.parentLink = parentLink;
    if (updateLink) {
      this._relabelGapKeys(updateLink);
    }
  }

  static prepChildren (
    treeIds: Array<TreeId>,
    blockLength: number
  ): ArrayFixedDense<GapLink<TreeId, GapKey>> {
    const keys = generateGapKeys(treeIds.length);
    const children = treeIds.map((treeId, index) => ({
      link: treeId,
      key: keys[index]
    }));
    children.length = blockLength;
    return ArrayFixedDense.fromArray(children, treeIds.length, true);
  }

  get space (): number {
    return this.children.length - this.children.count;
  }

  clone (): Node {
    return new Node(
      this.id,
      this.levelDelta,
      this.children.slice(),
      this.parentLink
    );
  }

  caret (
    updateLink: UpdateTreeLink,
    position: number,
    value: TreeId
  ): [GapKey, number] {
    if (this.space < 1) {
      throw new Error('Not enough space to caret in 1 entry');
    }
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
    position = this.children.caretRight(
      position,
      {
        link: value,
        key: gapKey
      }
    );
    if (needsRelabelling) {
      this._relabelGapKeys(updateLink);
      [gapKey] = this.children.get(position);
    }
    return [gapKey, position];
  }

  split (
    updateLink: UpdateTreeLink,
    idNew: TreeId,
    index?: number
  ): [Node, Node] {
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
      this.parentLink,
      updateLink
    );
    return [
      nodeLeft,
      nodeRight
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
      gapKey = generateGapKey(this.children.length, childPrev.key, childNext.key);
    } else if (childPrev) {
      // careting at the end
      gapKey = generateGapKey(this.children.length, childPrev.key);
    } else if (childNext) {
      // careting at the start
      gapKey = generateGapKey(this.children.length, null, childNext.key);
    } else if (childLast) {
      // careting past the end
      gapKey = generateGapKey(this.children.length, childLast.key);
    } else {
      // careting into empty array
      gapKey = generateGapKey(this.children.length);
    }
    return gapKey;
  }

  _relabelGapKeys (updateLink: UpdateTreeLink) {
    const keys = generateGapKeys(this.children.count);
    this.children.forEach((child, index) => {
      child.key = keys[index];
      updateLink(child.link, {
        link: this.id,
        key: child.key
      });
    });
  }

}

export { Leaf, Node };

export type { Tree, TreeId, UpdateNodeLink, UpdateTreeLink };
