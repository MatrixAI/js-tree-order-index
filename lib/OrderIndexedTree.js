// @flow

import type { NodeTableI } from './NodeTable.js';
import type { OrderIndexI } from './OrderIndex.js';

// the same link type must be used in both areas
// and that's it
// but without knowing what kind of link it is
// we have no way of knowing what kind of functions we expect to get

class OrderIndexedTree<link, data> {

  _nodes: NodeTableI<link, data>;
  _index: OrderIndexI<link>;

  // somebody constructs with nodetable and index
  // if they don't do so, it is empty
  // we can create a default representation
  constructor (nodes: NodeTableI<link, data>, index: OrderIndexI<link>) {
    this._nodes = nodes;
    this._index = index;
  }

  // how do we consider the root?
  // always assume {} is just root
  // and so when we return, we convert that root
  // back to just {}

  fromTree (tree: Object) {
  }

  toTree (): Object {
  }


  // takes a node, and gives back the entry
  // while nodes are within the realm of the node table
  // what would the consumer of tree index use of the entry itself?
  // except to ask other queries
  // this means  our "cursor" is botha cursor into the node table and a cursor into the order index
  findEntry (node) {
    this._index.findEntry(node.opening);
  }

  // we can GET a node
  // if you get a node
  // you need to search through the index
  // or you iterate over the nodes
  // you need to expose the NodeTableInterface here
  // because that's how you search for nodes
  //
  getNode (): NodeInterface {


    // what are the search parameters here?
    return this._nodes.node;

  }

  // all operations here either operate on a cursor (orderEntry)
  // or the node itself

  // we have to be clear that these nodes MUST exist within the tree index
  // which means these can't be external types
  // these must be internal types
  // something must give back a special encapsulated type
  // only to be returned back here
  // we need a closed ADT that is not exported
  isDescendant (node1: NodeInterface, node2: TreeNode): boolean {

    // what is the nodes?
    // they are types of node right?
    // so that means the NodeTableInterface must be a collection on a node type
    // or they are just general objects of some sort

  }

  isChild () {

  }

  isBeforePre () {

  }

  isBeforePost () {

  }

  level () {

  }

  isRoot () {

  }

  isLeaf () {

  }


  // all operations on the tree is now mediated through this
  // this represents an encoding of the tree structure
  // if this were to be loaded from disk to be indexed
  // then instead we would need to stream the tree contents in
  // however we would need to insert children and siblings accordingly
  // we'd start with an empty root, and build insertion via streaming tree
  // and then perform repeat insertion accordingly

}

export default OrderIndexedTree;
