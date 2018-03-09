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

// the parentId is not set for the left block
// why is that?

// [ KEY, { id: null, status: false } ]
// this can only be so if the fillId is wrong
// that is the id wasn't filled for whatever reason

// so we get I AM FILLED console.logged
// AFTER updateLink applied
// so basically what we are saying
// is that Open and Close entries are inserted
// then open close and are inserted again
// but by that time, the insertion occurs, and split occurs immediately
// so in that moment, the id still hasn't been filled
// because the node table doesn't have them inserted yet!
