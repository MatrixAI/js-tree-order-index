//@flow

type NodeId = number;
type NodeLevel = number;

type Node<data: Object, linkOpen: Object, linkClose: Object> = {|
  ...data,
  ...linkOpen,
  ...linkClose,
  ...{| id: NodeId, level: NodeLevel |}
|};

interface NodeTableI<data, linkOpen, linkClose> {

  // so now we have to check if the nodeID has been acquired
  // if not throw an error, and say you need to acquire the node id first
  // and if so, check if the table already has it
  // if not, then insert
  // if yes, throw an error saying that node is already being occupied
  // it should be an exception, since you must actually have a NodeId
  // before you can get insertion
  // so expect insertions to succeed if not, it's an exception
  // note that there's a way to deal with this
  // by making the implementation export opaque types
  // while still satisfying the interface
  // I don't know if you can satisfy an interface with an opaque type, or if the type needs to be then some sort of generic type on the interface itself

  acquireNodeId (): NodeId; // this may require the resource-counter or the backing system to know about tempids

  // if something already occupies a NodeId
  // it cannot be filled
  // it must be a number that is acquired
  insertNode (
    NodeId,
    data,
    NodeLevel,
    linkOpen,
    linkClose
  ): [
    Node<data, linkOpen, linkClose>,
    NodeTableI<data, linkOpen, linkClose>
  ];

  // do this in one bulk insertion
  // so we only get 1 new db, not a new db for every insertion
  insertNodes (
    Array<[
      NodeId,
      data,
      NodeLevel,
      linkOpen,
      linkClose
    ]>
  ): [
    Array<Node<data, linkOpen, linkClose>>,
    NodeTableI<data, linkOpen, linkClose>
  ];

  // we may not have that node you want deleted
  deleteNode (
    NodeId
  ): ?[
    Node<data, linkOpen, linkClose>,
    NodeTableI<data, linkOpen, linkClose>
  ];

  // bulk deletion
  // if any are not available, then we don't proceed
  deleteNodes (
    Array<NodeId>
  ): ?[
    Array<Node<data, linkOpen, linkClose>>,
    NodeTableI<data, linkOpen, linkClose>
  ];

  // generic query operation
  // hopefully the backing structure has indexes to make this faster
  searchNodes<k: $Keys<Node<data, linkOpen, linkClose>>> (
    k,
    $ElementType<Node<data, linkOpen, linkClose>, k>
  ): Array<Node<data, linkOpen, linkClose>>;

}

export type { NodeId, NodeLevel, Node, NodeTableI };
