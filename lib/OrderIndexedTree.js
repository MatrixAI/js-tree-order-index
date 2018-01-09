// @flow

// insert nodedata into node table with empty links
// create order entry with node id and open/closed
// insert into orderindex and get back link
// save the link back into the nodetable
// with every in-memory, this is easy
// WRITE TO NODE TABLE
// WRITE TO ORDER INDEX
// WRITE TO NODE TABLE (UPDATE)
// even if it was the other way around, it would still be 3 writes
// which is faster to update?
// it depends on whether you can have direct access to the node or entry
// if it is the entry, then it is easier to update it
// if it is the node, then it is easier to update that
// HOWEVER if you allow entries with no id, you can get an invalid order index tree
// whereas it makes more sense to have links that are null in the node table
// which indicates that the node that not been indexed yet
// what about level number!
// traversal operations must be defined on this to allow traversal and navigation similar to JSON data
// because our serialisation depends on this as well
// so you must be able to go into a property, and get all the children of that property.. etc
// inserting into this OrderIndexedTree
// means this
// YOU HAVE the PARENT node: A
// you want to insert into the last child of A
// this means you ALREADY have the node data for A
// you HAVE the links to A's order entry
// THIS means you have a Leaf block for A
// and you know you want to insert as a child of A
// this means you want the OPENING entry of A
// and CLOSING entry of A
// you want to insert right into the middle between OPENING and CLOSING of A


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

    // we need to supply the construction with the function that links the 2 together
    // updateLink = (nodeId: number, openLink: link, closingLink: link) => { ... }
    // note that this OrderIndexedTree relies on external construction
    // so we assume that this is already supplied then

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
