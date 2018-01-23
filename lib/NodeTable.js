//@flow

type NodeInitial<data: Object> = {|
  ...data,
  ...{| id: number, level: number |}
|};

type NodeFinal<data: Object, linkOpen: Object, linkClose: Object> = {|
  ...data,
  ...linkOpen,
  ...linkClose,
  ...{| id: number, level: number |}
|};

type Node<data: Object, linkOpen: Object, linkClose: Object> =
  NodeInitial<data> | NodeFinal<data, linkOpen, linkClose>;

interface NodeTableI<data, linkOpen, linkClose> {

  // insert a new node with no links
  // this doesn't modify the initial table
  // it gives you a new table with those details
  insertInitial (
    data,
    number
  ): [[number, NodeInitial<data>], NodeTableI<data, linkOpen, linkClose>];

  // for bulk loading you need to do this with multiple in one go
  insertInitials (
    Array<[data, number]>
  ): [
    Array<[number, NodeInitial<data>]>,
    NodeTableI<data, linkOpen, linkClose>
  ];

  // convert node initial to node final
  // updates the nodetable (the table is not changed here)
  // mutates the current NodeTableI
  updateInitialToFinal (
    NodeInitial<data>,
    linkOpen,
    linkClose
  ): NodeFinal<data, linkOpen, linkClose>;



  getNodeById (number): ?NodeFinal<data, linkOpen, linkClose>;

  searchNodes<k: $Keys<Node<data, linkOpen, linkClose>>> (
    k,
    $ElementType<Node<data, linkOpen, linkClose>, k>
  ): Array<NodeFinal<data, linkOpen, linkClose>>;



  // this is a mutation as well
  // and we also deal with this accordingly
  // we return the new node table with the node deleted
  // should we work by nodes instead
  // of using numbers?
  // we can always pass pointers around that's the same thing
  deleteNodeById (number): [
    [number, NodeFinal<data, linkOpen, linkClose>],
    NodeTableI<data, linkOpen, linkClose>
  ];


  // so first when we first insert, we get a NodeInitial
  // it is then to be filled to be replaced by NodeFinal


}

export type { NodeInitial, NodeFinal, Node, NodeTableI };
