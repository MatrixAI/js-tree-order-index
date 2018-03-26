// @flow

import type { OrderEntry, OrderCursorI } from '../OrderIndex.js';
import type { BOITree } from './BOITree.js';
import type { Leaf } from './BlockTree.js';
import type { TableLinkOpen, TableLinkClose } from './Links.js';

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
    const leaf = this._orderIndex._treeTable.get(node.leafOpen);
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
    const leaf = this._orderIndex._treeTable.get(node.leafClose);
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
        leafOpen: this._leaf.id,
        gapKeyOpen: gapKey
      };
    } else {
      return {
        leafClose: this._leaf.id,
        gapKeyClose: gapKey
      };
    }
  }

}

export default Cursor;
