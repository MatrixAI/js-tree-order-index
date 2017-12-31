// @flow

import type { NodeTableInterface } from './NodeTable.js';
import type { OrderIndexInterface } from './OrderIndex.js';


// perhaps this class is generic on TreeNode type?
// that is TreeIndex is generic on what the node is
// and therefore we need to state what kind of node it is
// furthermore then nodes is a collection parameterised on the node itself
// i also feel that this TreeIndex should encapsulate the type of TreeNode
// so that it should be defined what a TreeNode is
// and what we expect of it
// we can define an interface for this as well

// what is the tree node?
// I don't know?
// but shouldn't then we know that a tree node must be used by the interface as well?
class TreeNode implements NodeInterface {

}

// N which is a node contains information about itself, it does not need to contain the links
// we assume N is any object
// we are the ones that create an ID and Backlinks
// all other information is about N
// however any table collection requires going from ID -> [N, Backlinks]
// and N -> [ID, Backlinks]
// and Backlinks -> [ID, N]
// that makes it a bimap, where N is indexed (as a pointer), and ID is indexed as an integer, and Backlinks is indexed (not sure what this means, I'm guessing it's a pointer of some sort)

class TreeIndex<N> {

  // both the node table and order index tree must agree on the same link type
  // the link type is designated by OrderLink
  // but the idea is that TreeIndex chooses a particular link type
  // otherwise the instances won't know what they are operating against
  // specifically the choice of implementation would choose it was well?
  // or during initialisation some choices are already made
  // so if you don't specify what it is, what does it mean here?
  _nodes: NodeTableInterface<N>;
  _index: OrderIndexInterface<L>;

  constructor (nodes: NodeTableInterface<N>, index: OrderIndexInterface) {
    this._nodes = nodes;
    this._index = index;
  }

  // we load a tree object and actually encode it into our nodes table
  // and our index
  // we'll supply a default nodes table
  // that isn't too efficient
  loadTree (tree: {}) {
    // do something here
  }

  toTree () {
    // somehow rebuild the original tree
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

export default TreeIndex;
