//@flow

import type { node, NodeTableInterface } from '../NodeTable.js';
import type { orderLink } from '../OrderLinks.js';

class NodeArray<L: orderLink> implements NodeTableInterface<L> {

  _counter: number;
  _arr: Array<node<L>>;

  constructor () {
    this._counter = -1;
    this._arr = [];
  }

  insert (
    nodeOrig: Object,
    lower: L,
    upper: L
  ): [number, node<L>] {
    const id = ++this._counter;
    const node = {
      ...nodeOrig,
      id: id,
      lower: lower,
      upper: upper
    };
    this._arr.push(node);
    return [id, node];
  }

  lookupById (id: number): ?node<L> {
    return this._arr.find((node) => {
      return node.id === id;
    });
  }

  deleteById (id: number): void {
    this._arr.find((node, index) => {
      if (node.id === id) {
        this._arr.splice(index, 1);
        return true;
      }
      return false;
    });
    return;
  }

  setLinksById (
    id: number,
    lower: ?L,
    upper: ?L
  ): void {
    if (lower == null && upper == null) {
      return;
    }
    const node = this._arr.find((node) => {
      return node.id === id;
    });
    if (node) {
      if (lower != null) {
        node.lower = lower;
      }
      if (upper != null) {
        node.upper = upper;
      }
    }
    return;
  }

  [Symbol.iterator] () {
    return this._arr.values();
  }

}

export default NodeArray;
