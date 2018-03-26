import NodeDataScript from './lib/NodeTables/NodeDataScript.js';
import BOITree from './lib/OrderIndex/BOITree.js';

const nodeTable = new NodeDataScript({
  new: true,
  keysIndexed: new Set(['gapKeyOpen', 'gapKeyClose']),
  keysIndexedObjects: new Set(['leafOpen', 'leafClose']),
  keysIndexedObjectsTagSuffix: '-tag'
});

const tree0 = new BOITree({
  blockSize: 4,
  nodeTable: nodeTable
});

const [nodeId1, tree1] = tree0.insertRoot({
  name: 'Hi I am the root'
});

const [nodeId2, tree2] = tree1.insertChild(nodeId1, 0, {
  name: 'Hi I am the child of the root'
});

const [nodeId3, tree3] = tree2.insertSibling(nodeId2, true, {
  name: 'Hi I am the sibling of child 1'
});

const [nodeId4, tree4] = tree3.insertSibling(nodeId2, false, {
  name: 'Hi I am the right sibling of child 1'
});

console.log(tree4._treeTable);
console.log(tree4._treeTable.get(0).children._array);
console.log(tree4._treeTable.get(3).children._array);
console.log(tree4._treeTable.get(1).children._array);
console.log(tree4._treeTable.get(4).children._array);

console.log(tree4._treeTable.get(2).children._array);
console.log(tree4._treeTable.get(6).children._array);

console.log(tree4._treeTable.get(5).children._array);

// console.log(tree3._nodeTable.getNode(1));
// console.log(tree3._nodeTable.getNode(2));
// console.log(tree3._nodeTable.getNode(3));
