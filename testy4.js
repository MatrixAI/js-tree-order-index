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

console.log(boTree);
