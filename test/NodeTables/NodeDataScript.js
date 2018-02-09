import test from 'ava';
import NodeDataScript from '../../lib/NodeTables/NodeDataScript.js';

test('insertion of nodes gives back unique ids', t => {
  let table = new NodeDataScript({
    new: true,
    keysIndexed: new Set(['textKey']),
    keysIndexedObjects: new Set(['objectKey']),
    keysIndexedObjectsTagSuffix: '-tag'
  });
  // insertion data
  const obj1 = {};
  const obj2 = {};
  const openLink = {
    blockOpen: obj1,
    keyOpen: 1
  };
  const closeLink = {
    blockClose: obj1,
    keyClose: 2
  };
  const data = {
    textKey: 'abc',
    objectKey: obj2,
    unindexedKey: 10
  };
  const level = 1;
  let node;
  let id1;
  // insert first node
  [node, table] = table.insertNode(
    level,
    openLink,
    closeLink,
    data,
    (id) => {
      id1 = id;
    }
  );
  // the returned object must be a legitimate node
  t.deepEqual(
    node,
    {
      ...openLink,
      ...closeLink,
      ...data,
      id: id1,
      level: level
    }
  );
  // insert the second node
  let id2;
  [node, table] = table.insertNode(
    level,
    openLink,
    closeLink,
    data,
    (id) => {
      id2 = id;
    }
  );
  // the returned object must be a legitimate node
  t.deepEqual(
    node,
    {
      ...openLink,
      ...closeLink,
      ...data,
      id: id2,
      level: level
    }
  );
  // the ids inserted must be unique
  t.not(id1, id2);
});

test('can search for inserted nodes', t => {
  let table = new NodeDataScript({
    new: true,
    keysIndexed: new Set(['textKey']),
    keysIndexedObjects: new Set(['objectKey', 'blockOpen', 'blockClose']),
    keysIndexedObjectsTagSuffix: '-tag'
  });
  // we shall use obj1 for both node1.objectKey and node2.objectKey
  const obj1 = {};
  // we shall use obj2 for both node1.blockOpen and node2.blockClose
  const obj2 = {};
  // node1
  const level1 = 1;
  const openLink1 = {
    blockOpen: obj2,
    keyOpen: 1
  };
  const closeLink1 = {
    blockClose: {},
    keyClose: 2
  };
  const data1 = {
    textKey: 'abc',
    objectKey: obj1,
    unindexedKey: 10
  };
  // node2
  const level2 = 2;
  const openLink2 = {
    blockOpen: {},
    keyOpen: 1
  };
  const closeLink2 = {
    blockClose: obj2,
    keyClose: 2
  };
  const data2 = {
    textKey: 'abcd',
    objectKey: obj1,
    unindexedKey: 11
  };
  let node1;
  let node2;
  [node1, table] = table.insertNode(
    level1,
    openLink1,
    closeLink1,
    data1
  );
  [node2, table] = table.insertNode(
    level2,
    openLink2,
    closeLink2,
    data2
  );
  let results;
  // search by indexed objectKey
  results = table.searchNodes('objectKey', node1.objectKey);
  t.is(results.length, 2);
  // how do we know which one occurs first?
  // easy, due to sequential tagging
  t.deepEqual(results[0], node1);
  t.deepEqual(results[1], node2);
  // search by indexed node1.textKey
  results = table.searchNodes('textKey', node1.textKey);
  t.is(results.length, 1);
  t.deepEqual(results[0], node1);
  // search by indexed node2.textKey
  results = table.searchNodes('textKey', node2.textKey);
  t.is(results.length, 1);
  t.deepEqual(results[0], node2);
  // search by node1.unindexedKey
  results = table.searchNodes('unindexedKey', node1.unindexedKey);
  t.is(results.length, 1);
  t.deepEqual(results[0], node1);
  // search by node2.unindexedKey
  results = table.searchNodes('unindexedKey', node2.unindexedKey);
  t.is(results.length, 1);
  t.deepEqual(results[0], node2);
  // search by node1.blockOpen (even though it is used by node2.blockClose)
  results = table.searchNodes('blockOpen', node1.blockOpen);
  t.is(results.length, 1);
  t.deepEqual(results[0], node1);
  // search by node2.blockClose (even though it is used by node1.blockOpen)
  results = table.searchNodes('blockClose', node2.blockClose);
  t.is(results.length, 1);
  t.deepEqual(results[0], node2);
});

test('deletion of nodes affects search', t => {
  let table = new NodeDataScript({
    new: true,
    keysIndexed: new Set(['textKey']),
    keysIndexedObjects: new Set(['objectKey', 'blockOpen', 'blockClose']),
    keysIndexedObjectsTagSuffix: '-tag'
  });
  // we shall use obj1 for both node1.objectKey and node2.objectKey
  const obj1 = {};
  // we shall use obj2 for both node1.blockOpen and node2.blockClose
  const obj2 = {};
  // node1
  const level1 = 1;
  const openLink1 = {
    blockOpen: obj2,
    keyOpen: 1
  };
  const closeLink1 = {
    blockClose: {},
    keyClose: 2
  };
  const data1 = {
    textKey: 'abc',
    objectKey: obj1,
    unindexedKey: 10
  };
  // node2
  const level2 = 2;
  const openLink2 = {
    blockOpen: {},
    keyOpen: 1
  };
  const closeLink2 = {
    blockClose: obj2,
    keyClose: 2
  };
  const data2 = {
    textKey: 'abcd',
    objectKey: obj1,
    unindexedKey: 11
  };
  let node1;
  let node2;
  [node1, table] = table.insertNode(
    level1,
    openLink1,
    closeLink1,
    data1
  );
  [node2, table] = table.insertNode(
    level2,
    openLink2,
    closeLink2,
    data2
  );
  // table2 will diverge with a deletion of node1
  let table2;
  [, table2] = table.deleteNode(node1.id);
  // table3 will diverge with deletion of node2
  let table3;
  [, table3] = table.deleteNode(node2.id);
  // table4 will diverge with deletion of node1 and node2
  let table4;
  [, table4] = table2.deleteNode(node2.id);


  t.pass();
});
