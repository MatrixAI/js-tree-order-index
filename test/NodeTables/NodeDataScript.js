import test from 'ava';
import NodeDataScript from '../../lib/NodeTables/NodeDataScript.js';

// for the purposes of this test, we must know that
// ava t.is uses Object.is
// ava t.deepEqual does not check object identity
// so even after using t.deepEqual, you must use Object.is to check object identity

test('insertion of nodes gives back unique ids', t => {
  let table = new NodeDataScript({
    new: true,
    keysIndexed: new Set(['textKey']),
    keysIndexedObjects: new Set(['objectKey']),
    keysIndexedObjectsTagSuffix: '-tag'
  });
  // insertion data
  const obj1 = {};
  const obj2 = new Date;
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
  // ensuring object identity after insertion
  t.is(node.objectKey, data.objectKey);
  t.is(node.blockOpen, openLink.blockOpen);
  t.is(node.blockClose, closeLink.blockClose);
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
  // ensuring object identity after insertion
  t.is(node.objectKey, data.objectKey);
  t.is(node.objectKey, data.objectKey);
  t.is(node.blockOpen, openLink.blockOpen);
  t.is(node.blockClose, closeLink.blockClose);
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
  const obj1 = new Number(1);
  // we shall use obj2 for both node1.blockOpen and node2.blockClose
  const obj2 = Object.create(null);
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
    unindexedKey: 10,
    unindexedTextKey: 'hi'
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
    unindexedKey: 11,
    unindexedTextKey: 'hi'
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
  // testing object identity
  t.is(node1.objectKey, data1.objectKey);
  t.is(node1.blockOpen, openLink1.blockOpen);
  t.is(node1.blockClose, closeLink1.blockClose);
  t.is(node2.objectKey, data2.objectKey);
  t.is(node2.blockOpen, openLink2.blockOpen);
  t.is(node2.blockClose, closeLink2.blockClose);
  let results;
  // search by indexed objectKey
  results = table.searchNodes('objectKey', node1.objectKey);
  t.is(results.length, 2);
  // how do we know which one occurs first?
  // easy, due to sequential tagging
  t.deepEqual(results[0], node1);
  t.deepEqual(results[1], node2);
  // search by unindexedTextKey
  results = table.searchNodes('unindexedTextKey', data1.unindexedTextKey);
  t.is(results.length, 2);
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
  // search by node1.blockClose
  results = table.searchNodes('blockClose', closeLink1.blockClose);
  t.is(results.length, 1);
  t.deepEqual(results[0], node1);
  // search by node2.blockOpen
  results = table.searchNodes('blockOpen', openLink2.blockOpen);
  t.is(results.length, 1);
  t.deepEqual(results[0], node2);
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
    blockClose: undefined,
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
    blockOpen: null,
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
  let node1Deleted;
  [node1Deleted, table2] = table.deleteNode(node1.id);
  t.deepEqual(node1Deleted, node1);
  t.is(node1Deleted.objectKey, node1.objectKey);
  // table3 will diverge with deletion of node2
  let table3;
  let node2Deleted;
  [node2Deleted, table3] = table.deleteNode(node2.id);
  t.deepEqual(node2Deleted, node2);
  // table4 will diverge with deletion of node1 and node2
  let table4;
  [node2Deleted, table4] = table2.deleteNode(node2.id);
  t.deepEqual(node2Deleted, node2);
  let results;
  // searching for obj1 on table will give both nodes
  results = table.searchNodes('objectKey', obj1);
  t.is(results.length, 2);
  t.deepEqual(results[0], node1);
  t.deepEqual(results[1], node2);
  // searching for obj1 on table2 will only give node2
  results = table2.searchNodes('objectKey', obj1);
  t.is(results.length, 1);
  t.deepEqual(results[0], node2);
  // searching for obj1 on table3 will only give node1
  results = table3.searchNodes('objectKey', obj1);
  t.is(results.length, 1);
  t.deepEqual(results[0], node1);
  // searching for obj1 on table4 will give no results
  results = table4.searchNodes('objectKey', obj1);
  t.is(results.length, 0);
});

test('update performs a patch on existing nodes', t => {
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
  // update only unindexedKey
  let node1_;
  [node1_, table] = table.updateNode(
    node1.id,
    {
      unindexedKey: 13
    }
  );
  t.deepEqual(
    node1_,
    {
      ...node1,
      unindexedKey: 13
    }
  );
  // check object identity between node1.objectKey and node1_.objectKey
  t.is(node1.objectKey, node1_.objectKey);
  // update the node.objectKey
  let node2_;
  [node2_, table] = table.updateNode(
    node2.id,
    {
      objectKey: obj2
    }
  );
  t.deepEqual(
    node2_,
    {
      ...node2,
      objectKey: obj2
    }
  );
  // check object identity between node2.blockOpen and node2_.blockOpen
  // and node2.blockClose and node2_.blockClose
  t.is(node2.blockOpen, node2_.blockOpen);
  t.is(node2.blockClose, node2_.blockClose);
  let results;
  // search with obj1 should only return node1_
  results = table.searchNodes('objectKey', obj1);
  t.is(results.length, 1);
  t.deepEqual(results[0], node1_);
  // search with obj2 should only return node2_
  results = table.searchNodes('objectKey', obj2);
  t.is(results.length, 1);
  t.deepEqual(results[0], node2_);
  t.is(results[0].objectKey, node2_.objectKey);
  // update node1_ back to objectKey: obj2
  [, table] = table.updateNode(
    node1_.id,
    {
      objectKey: obj2
    }
  );
  results = table.searchNodes('objectKey', obj2);
  t.is(results.length, 2);
  t.deepEqual(
    results[0],
    {
      ...node1_,
      objectKey: obj2
    }
  );
  t.is(results[0].objectKey, obj2);
  t.deepEqual(results[1], node2_);
  t.is(results[1].objectKey, obj2);
  // update with something that is the same should do nothing
  let [nodeNoChange, tableNoChange] = table.updateNode(
    node2_.id,
    {
      textKey: data2.textKey
    }
  );
  t.deepEqual(nodeNoChange, node2_);
  t.is(nodeNoChange.objectKey, node2_.objectKey);
  t.is(tableNoChange, table);
});

test('bulk loading', t => {
  let table = new NodeDataScript({
    new: true,
    keysIndexed: new Set(['textKey']),
    keysIndexedObjects: new Set(['objectKey', 'blockOpen', 'blockClose']),
    keysIndexedObjectsTagSuffix: '-tag'
  });
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
  let insertedNodes;
  let id2;
  [insertedNodes, table] = table.loadNodes([
    [1, openLink, closeLink, data],
    [2, openLink, closeLink, data, (id) => { id2 = id; }],
    [3, openLink, closeLink, data]
  ]);
  t.is(id2, insertedNodes[1].id);
  t.is(insertedNodes.length, 3);
  t.deepEqual(
    insertedNodes[0],
    {
      ...openLink,
      ...closeLink,
      ...data,
      level: 1,
      id: 1
    }
  );
  t.deepEqual(
    insertedNodes[1],
    {
      ...openLink,
      ...closeLink,
      ...data,
      level: 2,
      id: 2
    }
  );
  t.deepEqual(
    insertedNodes[2],
    {
      ...openLink,
      ...closeLink,
      ...data,
      level: 3,
      id: 3
    }
  );
});

test('transaction bundles up modifications', t => {
  let table = new NodeDataScript({
    new: true,
    keysIndexed: new Set(['textKey']),
    keysIndexedObjects: new Set(['objectKey', 'blockOpen', 'blockClose']),
    keysIndexedObjectsTagSuffix: '-tag'
  });
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
  let id1, id2, id3;
  let node1, node2, node3;
  table = table.transaction((tt) => {
    node1 = tt.insertNode(1, openLink, closeLink, data, (id) => { id1 = id; });
    [node2, node3] = tt.loadNodes(
      [
        [2, openLink, closeLink, data, (id) => { id2 = id; }],
        [3, openLink, closeLink, data, (id) => { id3 = id; }]
      ]
    );
    t.is(node1.id, id1);
    t.is(node2.id, id2);
    t.is(node3.id, id3);
    t.true(node1.id < node2.id);
    t.true(node2.id < node3.id);
    t.deepEqual(
      node1,
      {
        ...openLink,
        ...closeLink,
        ...data,
        id: id1,
        level: 1
      }
    );
    t.deepEqual(
      node2,
      {
        ...openLink,
        ...closeLink,
        ...data,
        id: id2,
        level: 2
      }
    );
    t.deepEqual(
      node3,
      {
        ...openLink,
        ...closeLink,
        ...data,
        id: id3,
        level: 3
      }
    );
    let results;
    results = tt.searchNodes('textKey', 'abc');
    t.is(results.length, 3);
    t.deepEqual(results[0], node1);
    t.deepEqual(results[1], node2);
    t.deepEqual(results[2], node3);
    results = tt.searchNodes('objectKey', obj2);
    t.is(results.length, 3);
    t.deepEqual(results[0], node1);
    t.deepEqual(results[1], node2);
    t.deepEqual(results[2], node3);
    results = tt.searchNodes('level', 1);
    t.is(results.length, 1);
    t.deepEqual(results[0], node1);
    let node2_ = tt.deleteNode(node2.id);
    t.deepEqual(node2_, node2);
    results = tt.searchNodes('objectKey', obj2);
    t.is(results.length, 2);
    t.deepEqual(results[0], node1);
    t.deepEqual(results[1], node3);
    tt.updateNode(node1.id, {
      objectKey: obj1
    });
    results = tt.searchNodes('objectKey', obj2);
    t.is(results.length, 1);
    t.deepEqual(results[0], node3);
    results = tt.searchNodes('objectKey', obj2);
    t.is(results.length, 1);
    t.deepEqual(results[0], node3);
    results = tt.getNodes();
    t.is(results.length, 2);
    tt.deleteNode(node1.id);
  });
  const results = table.getNodes();
  t.is(results.length, 1);
  t.deepEqual(results[0], node3);
});
