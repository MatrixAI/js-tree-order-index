import NodeDataScript from './lib/NodeTables/NodeDataScript.js';
import BOTree from './lib/OrderIndexes/BOTree.js';

const nodeTable = new NodeDataScript({
  new: true,
  keysIndexed: new Set(['gapKeyOpen', 'gapKeyClose']),
  keysIndexedObjects: new Set(['leafOpen', 'leafClose']),
  keysIndexedObjectsTagSuffix: '-tag'
});

const tree0 = new BOTree({
  blockSize: 4,
  nodeTable: nodeTable
});

const [node, tree1] = tree0.insertRoot({
  name: 'Hi I am Root!'
});

const [node2, tree2] = tree1.insertRoot({
  name: 'I am the new root!'
});

const [node3, tree3] = tree2.insertRoot({
  name: 'NAH I AM!'
});

console.log('TREE4 PRODUCE');

const [node4, tree4] = tree3.insertRoot({
  name: 'NOPE!'
});

// this should not have that many objects!

console.log('TREE0', tree0._treeTable);
console.log('TREE1', tree1._treeTable);
// console.log(tree1._treeTable.get(0));
console.log('TREE2', tree2._treeTable);

console.log(tree2._treeTable.get(0).children._array);
console.log(tree2._treeTable.get(1).children._array);
console.log(tree2._treeTable.get(2).children._array);

console.log('TREE3', tree3._treeTable);

console.log(tree3._treeTable.get(0));
console.log(tree3._treeTable.get(1));
console.log(tree3._treeTable.get(2));

console.log('TREE4', tree4._treeTable);

console.log('LENGTH of the table', tree4._treeTable.count());

console.log('ROOTID', tree4._rootId);
console.log('LEFTID', tree4._leftId);
console.log('RIGHTID', tree4._rightId);

console.log(tree4._treeTable.get(0));
console.log(tree4._treeTable.get(1));
console.log(tree4._treeTable.get(2));
console.log(tree4._treeTable.get(3));
console.log(tree4._treeTable.get(4));
console.log(tree4._treeTable.get(5));
console.log(tree4._treeTable.get(6));

console.log(tree4._treeTable.get(0).children._array);
console.log(tree4._treeTable.get(3).children._array);
console.log(tree4._treeTable.get(1).children._array);
console.log(tree4._treeTable.get(4).children._array);

// ok so we solve the problem with the weird splitting structure
// but we have another problem
// the insertion careting order is wrong
// the 4 and 1 should be swapped around
// and the next and prev ids are not consistent with the tree structure either
