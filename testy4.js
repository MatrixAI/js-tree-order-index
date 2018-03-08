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

console.log(node);
console.log(tree);

const [node2, tree2] = tree.insertRoot({
  name: 'I am the new root!'
});

console.log(node2, tree2);
