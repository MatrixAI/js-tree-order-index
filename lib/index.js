// @flow

import NodeArray from './NodeTables/NodeArray.js';
import BOTree from './OrderIndexes/BOTree.js';
import OrderIndexedTree from './OrderIndexedTree.js';

const defaultTree: OrderIndexedTree<GapLink<*>, *> =
  new OrderIndexedTree(
    new NodeArray,
    new BOTree(64, () => {
      // updateLink function defined here
    })
  );

export {
  NodeArray,
  BOTree,
  OrderIndexedTree
};

export default defaultTree;
