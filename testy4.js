import NodeDataScript from './lib/NodeTables/NodeDataScript.js';
import BOTree from './lib/OrderIndexes/BOTree.js';

const nodeTable = new NodeDataScript({
  new: true,
  keysIndexed: new Set(['gapKeyOpen', 'gapKeyClose']),
  keysIndexedObjects: new Set(['leafOpen', 'leafClose']),
  keysIndexedObjectsTagSuffix: '-tag'
});

const boTree = new BOTree({
  blockSize: 4,
  nodeTable: nodeTable
});


// this appears to do it twice
// why is the length and count wrong?

const [node, tree] = boTree.insertRoot({
  name: 'Hi I am Root!'
});

const [node2, tree2] = tree.insertRoot({
  name: 'I am the new root!'
});

const [node3, tree3] = tree2.insertRoot({
  name: 'NAH I AM!'
});

console.log('tree3 inserting root');

const [node4, tree4] = tree3.insertRoot({
  name: 'NOPE!'
});

// this should not have that many objects!

console.log(tree3._treeTable);
console.log(tree4._treeTable);

console.log(tree4._leftId);
console.log(tree4._rightId);
console.log(tree4._rootId);

// prevId is wrong

// node.split doesn't have this problem
// only leaf.split has this problem
// leaf split is the only one in which we need to fix this
// one way is for split to actually return 3 things
// leafLeft, leafRight, leafRightOrig
// that is the original right (if it exist) has the id added as well
// and it has it cloned
// wait we only have the id
// we don't have the existing block
// damn we would need to acquire the block from the treeTableT


// why is tree4._treeTable.get(1) returning a Leaf with prevId set to 0
// WHEN it should be set to 3
// and it should be setttt!!?!?!?

console.log(tree4._treeTable.get(0));
console.log(tree4._treeTable.get(1));
console.log(tree4._treeTable.get(2));
console.log(tree4._treeTable.get(3));
console.log(tree4._treeTable.get(4));
console.log(tree4._treeTable.get(5));
console.log(tree4._treeTable.get(6));
console.log(tree4._treeTable.get(7));
console.log(tree4._treeTable.get(8));
console.log(tree4._treeTable.get(9));

// several things are broken here:
// 1. the count for several ArrayFixedDense is SOMEHOW a floating point number
//  HOW IS THAT EVEN POSSIBLE? (the count isn't even properly updated)
// this must mean ArrayFixedDense must be broken
// cause this is just impossible
// there's nothing in this code that sets the count

// it is only nodes with incorrect count
// how did this occur?
