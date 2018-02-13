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


import type { Node, NodeTableI } from './NodeTable.js';
import type { OrderIndexI } from './OrderIndex.js';

// node is just pure data
// cursor maintains context (a consistent read snapshot)
// this means the 2 entry cursors share the same snapshot of the tree, nodetable and ppt

type CursorNode<cursor> = {
  open: cursor,
  close: cursor
} | {
  open: null,
  close: cursor
} | {
  open: cursor,
  close: null
};

class OrderIndexedTree<linkOpen, linkClose, data, cursor> {

  _table: NodeTableI<linkOpen, linkClose, data>;
  _index: OrderIndexI<linkOpen, linkClose, data, cursor>;

  constructor (
    table: NodeTableI<linkOpen, linkClose, data>,
    index: OrderIndexI<linkOpen, linkClose, data, cursor>
  ) {
    this._table = table;
    this._index = index;
  }

  fromTreeObject (treeObject: Object) {
  }

  toTreeObject (): Object {
  }

  isDescendant (
    node1: Node<linkOpen, linkClose, data>,
    node2: Node<linkOpen, linkClose, data>
  ): boolean {
  }

  isChild (
    node1: Node<linkOpen, linkClose, data>,
    node2: Node<linkOpen, linkClose, data>
  ): boolean {
  }

  isBeforePre (
    node1: Node<linkOpen, linkClose, data>,
    node2: Node<linkOpen, linkClose, data>
  ): boolean {
    // before in pre-order
  }

  isBeforePost (
    node1: Node<linkOpen, linkClose, data>,
    node2: Node<linkOpen, linkClose, data>
  ): boolean {
    // before in post-order
  }

  level (node: Node<linkOpen, linkClose, data>): number {
    // calculate the real level, and perform adjustment
    // set that the node is not level is adjusted, so cache it
  }

  isRoot (node: Node<linkOpen, linkClose, data>): boolean {
  }

  isLeaf (node: Node<linkOpen, linkClose, data>): boolean {
  }

  getCursor (node: Node): CursorNode<cursor> {
  }

  getNode (cursor: CursorNode<cursor>): Node<linkOpen, linkClose, data> {
  }

  // there's no inorder traversal since trees in general are multiway
  // so the traversal is then ambiguous

  nextPre (cursor: CursorNode<cursor>): CursorNode<cursor> {
    // next node in preorder
  }

  prevPre (cursor: CursorNode<cursor>): CursorNode<cursor> {
    // prev node in preorder
  }

  nextPost (cursor: CursorNode<cursor>): CursorNode<cursor> {
  }

  prevPost (cursor: CursorNode<cursor>): CursorNode<cursor> {
  }

  nextSibling (cursor: CursorNode<cursor>): CursorNode<cursor> {
  }

  prevSibling (cursor: CursorNode<cursor>): CursorNode<cursor> {
  }

  insertNode (
    nodeNew: Object,
    position: ?[Node, number]
  ) {

    // note that position can be null
    // in which case, it inserts at the root
    // also position may refer to something that already exists
    // if so, this is an exception
    // but what if we want to indicate 0 as leftmost
    // -1 as rightmost
    // so 1 is the first position on the left
    // so we have 2 sentinels in that case
    // yea that makes more sense as a positional notation

  }

  relocateNode (
    node: Node,
    position: [Node, number]
  ) {

  }

  relocateRange(
    nodeRange: [Node, Node],
    position: [Node, number]
  ) {

  }

  relocateInner (
    node: Node,
    positionRange: [Node, Node]
  ) {

    // this is like really relocate a single node

  }

}

export default OrderIndexedTree;
