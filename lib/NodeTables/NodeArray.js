
import type { NodeId, NodeLevel, Node, NodeImmutableProps, NodeTableI } from '../NodeTable.js';

import Counter from 'resource-counter';

class NodeArray<
  linkOpen: *,
  linkClose: *,
  data: *
> implements NodeTableI<
  linkOpen,
  linkClose,
  data
> {

  _nodes: Array<Node<data, linkOpen, linkClose>>;
  _counter: Counter;

  constructor (
    nodes: Array<Node<data, linkOpen, linkClose>> = [],
    counter: Counter = new Counter
  ) {
    this._nodes = nodes;
    this._counter = counter;
  }

  // $FlowFixMe: computed property
  [Symbol.iterator] (): Iterator<Node<data, linkOpen, linkClose>> {
    return this._nodes[Symbol.iterator]();
  }

  acquireNodeId (): NodeId {
    return this._counter.allocate();
  }

  insertNode (
    id: NodeId,
    level: NodeLevel,
    linkOpen: linkOpen,
    linkClose: linkClose,
    data: data
  ): [
    Node<data, linkOpen, linkClose>,
    NodeTableI<data, linkOpen, linkClose>
  ] {
    if (!this._counter.check(id)) {
      throw ReferenceError('NodeId was not acquired before insertion!');
    }
    const node = {
      ...data,
      ...linkOpen,
      ...linkClose,
      id: id,
      level: level
    };
    const nodes = this._nodes.slice();
    nodes.push(node);

    // oh shit do we need to copy the this._counter
    // since now the old one will also have it
    // and that's bad
    // OMG we cannot easily copy the counter
    // what's the point
    // if the counter itself can be made immutable
    // then this would work
    // otherwise it's a problem
    // so that adding a counter means giving a new counter
    // then we are just passing the same immutable counter over

    const nodeArray = new NodeArray(nodes, this._counter);
    return [node, nodeArray];
  }

  insertNode (
    insertions: Array<[NodeId, NodeLevel, linkOpen, linkClose, data]>
  ): [
    Array<Node<data, linkOpen, linkClose>>,
    NodeTableI<data, linkOpen, linkClose>
  ] {
    const nodes = this._nodes.slice();
    const nodesInserted = [];
    let node;
    for (let [id, level, linkOpen, linkClose, data] of insertions) {
      if (!this._counter.check(id)) {
        throw ReferenceError('NodeId was not acquired before insertion!');
      }
      node = {
        ...data,
        ...linkOpen,
        ...linkClose,
        id: id,
        level: level
      };
      nodes.push(node);
      nodesInserted.push(node);
    }
    const nodeArray = new NodeArray(nodes, this._counter);
    return [nodesInserted, nodeArray];
  }

  deleteNode (
    id: NodeId
  ): ?[
    Node<data, linkOpen, linkClose>,
    NodeTableI<data, linkOpen, linkClose>
  ] {

    // does it matter if our array is sparse or not?
    // not it doesn't, we can just keep deleting
    // each time we do a copy that doesn't protect sparseness
    // so we just compact the array
    // otherwise we are just deleting the elements

    let found = false;
    const nodes = this._nodes.filter((node) => {
      if (node.id === id) {
        found = true;
        return false;
      }
      return true;
    });
    if (found) {

      const nodeArray = new NodeArray(nodes, this._counter);

    }
    return null;
  }

  deleteNodes () {

  }

  updateNode () {

  }

  updateNodes () {

  }

  searchNodes () {

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
