import NodeArray from './lib/NodeTables/NodeArray.js';

// note how we have multiple things with sections
// in XML

// our CST is like { name: blah }
// oooo we are indexing a rose tree lol
// so we have to have different ways of understanding [] vs objects
// for objects, we use named keys
// for [], we use numeric indices as keys
// yep we need to use rosetrees instead
// so you cannot directly access an element, except via an index
// so once this tree is indexed
// it should be easier to find the necessary element
// by building text indices, or tracking what each node actually contains
// so it should be possible to both get all children under a node
// and find all nodes that have a particular name
// so you can do /root/section[name = "abc"]
// get section under root where name is abc
// i may actualy neeed a real database at that point
// yea we'll need to use a real database:
// lovefield by google
// lokijs not as relational, more document oriented
// that may be what we need, but not part of the order index
// it matters what the NodesTable is setup
// as that is part of the interface
// we require accesses to the NodesTable
// to present a particular kind of interface
// if we use lovefield/lokijs/gun, accesses to the table is mediated through there because node state is stored there
// while our index is a secondary index
// we expect a rational db, not something that will then do more weird things

let tree = {
  name: 'root',
  children: [
    {
      name: 'section',
      children: [
        {
          name: 'heading',
          value: 'S1',
          children: []
        },
        {
          name: 'keyvalue',
          children: [
            {
              name: 'key1',
              value: 'value2',
              children: []
            },
            {
              name: 'key2',
              value: 'value2',
              children: []
            }
          ]
        }
      ]
    },
    {
      name: 'section',
      children: [
        {
          name: 'heading',
          value: 'S2',
          children: []
        }
      ]
    }
  ]
};

