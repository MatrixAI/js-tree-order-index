import test from 'ava';
import NodeDataScript from '../../lib/NodeTables/NodeDataScript.js';

test('insertion', t => {
  let table = new NodeDataScript({
    new: true,
    keysIndexed: new Set(['textKey']),
    keysIndexedObjects: new Set(['objectKey']),
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
  const level = 1;
  let node;
  let id;
  [node, table] = table.insertNode(
    level,
    openLink,
    closeLink,
    data,
    (id_) => {
      id = id_;
      t.is(id, 1)
    }
  );
  t.deepEqual(
    node,
    {
      ...openLink,
      ...closeLink,
      ...data,
      id: id,
      level: level
    }
  );
  [node, table] = table.insertNode(
    level,
    openLink,
    closeLink,
    data,
    (id_) => {
      id = id_;
      t.is(id, 2);
    }
  );
  t.deepEqual(
    node,
    {
      ...openLink,
      ...closeLink,
      ...data,
      id: id,
      level: level
    }
  );

  // how do we know whether something is indexed or not
  // the only way is through performance test

});
