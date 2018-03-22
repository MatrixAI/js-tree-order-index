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

// -1 is wrong
// it should be the same as 1
const [nodeId3, tree3] = tree2.insertChild(nodeId1, -1, {
  name: 'Hi I am the child 2 of the root'
});


/*
  Map { 0: [object Object], 1: [object Object], 2: [object Object], 3: [object Object] }
  [ [ 1801439850948198, { id: 1, status: true } ],
    [ 3602879701896396, { id: 2, status: true } ],
    <2 empty items> ]
  [ [ 3002399751580330, { id: 2, status: false } ],
    [ 4503599627370495, { id: 3, status: true } ],
    <2 empty items> ]
  [ [ 3002399751580330, { id: 3, status: false } ],
    [ 6004799503160660, { id: 1, status: false } ],
    <2 empty items> ]
  [ 0, 1, 3, <1 empty item> ]
*/

// using -1, it is doing (swapping order):

/*
  Map { 0: [object Object], 1: [object Object], 2: [object Object], 3: [object Object] }
  [ [ 900719925474099, { id: 3, status: true } ],
    [ 1351079888211148, { id: 3, status: false } ],
    <2 empty items> ]
  [ [ 3002399751580330, { id: 1, status: true } ],
    [ 6004799503160660, { id: 2, status: true } ],
    <2 empty items> ]
  [ [ 3002399751580330, { id: 2, status: false } ],
    [ 6004799503160660, { id: 1, status: false } ],
    <2 empty items> ]
  [ 0, 3, 1, <1 empty item> ]
 */


console.log(tree3._treeTable);
console.log(tree3._treeTable.get(0).children._array);
console.log(tree3._treeTable.get(1).children._array);
console.log(tree3._treeTable.get(3).children._array);
console.log(tree3._treeTable.get(2).children._array);

// wait I don't think 2's level is correct
