// @flow

import type { NodeTableI, Node } from '../NodeTable.js';
import type { OrderLinkI } from '../OrderLink.js';

class NodeArray<link: OrderLinkI, data: *> implements NodeTableI<link, data> {

  _nodes: Array<Node<link, data>>;
  _counter: number;

  constructor (nodes: ?Array<Node<link, data>>) {
    this._nodes = nodes || [];
    this._counter = -1;
  }

  // $FlowFixMe: computed property
  [Symbol.iterator] (): Iterator<Node<link, data>> {
    return this._nodes.entries();
  }

  insertNode (
    nodeData: data,
    opening: ?link,
    closing: ?link,
    level: ?number
  ): [number, Node<link, data>] {
    const id = ++this._counter;
    const node = {
      ...nodeData,
      id: id
    };
    if (opening != null) node.opening = opening;
    if (closing != null) node.closing = closing;
    if (level != null) node.level = level;
    this._nodes.push(node);
    return [id, node];
  }

  getNodeById (id: number): ?Node<link, data> {
    return this._nodes.find((node) => {
      return node.id === id;
    });
  }

  deleteNodeById (id: number): void {
    this._nodes.find((node, index) => {
      if (node.id === id) {
        this._nodes.splice(index, 1);
        return true;
      }
      return false;
    });
    return;
  }

}

export default NodeArray;
