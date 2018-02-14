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
import type { GapLinkOpen, GapLinkClose } from './OrderLinks/GapLink.js';

// node is just pure data
// cursor maintains context (a consistent read snapshot)
// this means the 2 entry cursors share the same snapshot of the tree, nodetable and ppt

// we also need to keep track of stuff here...?


// we say that Node contains linkOpen (at least the object is)
// where linkOpen is left generic
// how do we know how to create a function that takes the linkOpen
// and grabs its actual link?
// function getLinkOpen<linkOpen> (node: Node<linkOpen, linkClose>): linkOpen
// is that possible?
// it would would depend on what linkOpen is
// but linkOpen is a type of some sort which could be a gaplink
// so that could be a pointer to a block + pointer to the
// this means Node isn't just a type object
// it's also an interface
// more specifically it will havea type
// so what ever implements it needs to choose what it is


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

// we don't direclty access data
// but we need to fix linkOpen and linkClose
// so we know what it is now, since we fixed it
// note that we cannot create aliases inside the class

// we are fixing the links
// directly with GapLinkOpen and GapLinkClose
// note that this link only makes sense for the specific linkOpen
// so we are saying that there must be something that uses this

// you must use the gaplink!
// grrrr

class OrderIndexedTree<data, cursor> {

  _table: NodeTableI<GapLinkOpen, GapLinkClose, data>;
  _index: OrderIndexI<GapLinkOpen, GapLinkClose, cursor>;

  constructor (
    table: NodeTableI<GapLinkOpen, GapLinkClose, data>,
    index: OrderIndexI<GapLinkOpen, GapLinkClose, cursor>,
    extractLinkOpen: (GapLinkOpen) => GapLinkOpen,
    extractLinkClose: (GapLinkClose) => GapLinkClose
  ) {
    this._table = table;
    this._index = index;
    this._extractLinkOpen = extractLinkOpen;
    this._extractLinkClose = extractLinkClose;
  }

  fromTreeObject (treeObject: Object) {
  }

  toTreeObject (): Object {
  }

  isDescendant (
    node1: Node<GapLinkOpen, GapLinkClose, data>,
    node2: Node<GapLinkOpen, GapLinkClose, data>
  ): boolean {
  }

  isChild (
    node1: Node<GapLinkOpen, GapLinkClose, data>,
    node2: Node<GapLinkOpen, GapLinkClose, data>
  ): boolean {
  }

  isBeforePre (
    node1: Node<GapLinkOpen, GapLinkClose, data>,
    node2: Node<GapLinkOpen, GapLinkClose, data>
  ): boolean {
    // before in pre-order
  }

  isBeforePost (
    node1: Node<GapLinkOpen, GapLinkClose, data>,
    node2: Node<GapLinkOpen, GapLinkClose, data>
  ): boolean {
    // before in post-order
  }

  level (node: Node<GapLinkOpen, GapLinkClose, data>): number {
    // calculate the real level, and perform adjustment
    // set that the node is not level is adjusted, so cache it
  }

  isRoot (node: Node<GapLinkOpen, GapLinkClose, data>): boolean {
  }

  isLeaf (node: Node<GapLinkOpen, GapLinkClose, data>): boolean {
  }

  getCursor (node: Node): CursorNode<cursor> {
  }

  getNode (cursor: CursorNode<cursor>): Node<GapLinkOpen, GapLinkClose, data> {
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
    dataInserted: data,
    position: ?[Node, number]
  ): Node<GapLinkOpen, GapLinkClose, data> {
    let nodeInserted, table, tree;
    if (!position) {
      let openlink, closeLink, level, fillWithId;
      [
        [openLink, closeLink, level, fillWithId],
        tree
      ] = this._index.insertRoot();
      [nodeInserted, table] = this._table.insertNode(
        level,
        openLink,
        closeLink
        dataInserted,
        fillWithId
      );
    } else {
      let openLink, closeLink, level, fillWithId;
      const [posNode, posIndex] = position;
      [
        [openLink, closeLink, level, fillWithId],
        tree
      ] = this._index.insertChild(
        this._extractLinkOpen(node),
        this._extractLinkClose(node),
        posIndex
      );
      [nodeInserted, table] = this._table.insertNode(
        level,
        openLink,
        closeLink,
        dataInserted,
        fillWithId
      );
    }

    // do something with the new tree and table
    // it's probably meant to be immmutable of some sort
    // so changes return a new orderindexedtree

    return nodeInserted;
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

    // it is not allowed that the position node is within the node range

  }

  relocateInner (
    node: Node,
    positionRange: [Node, Node]
  ) {

    // this is like really relocate a single node
    // it is not allowed that the node is within the position range

  }

}

export default OrderIndexedTree;
