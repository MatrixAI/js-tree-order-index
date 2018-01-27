// @flow

type NodeId = number;
type NodeLevel = number;

type Node<linkOpen: Object, linkClose: Object, data: Object> = {|
  ...{| id: NodeId, level: NodeLevel |},
  ...linkOpen,
  ...linkClose
  ...data
|};

// using the combination of transaction method
// and the usage of push
// and the usage of a callback system
// it should be possible to eliminate
// the need to use the resource-counter
// instead ids are just part of the transactional process
// HOWEVER...
// this does not solve the problem of structure sharing
// to do this while achieving indexing, we need to use datascript
// however either we just use ++counter
// or we convert resource-counter into an immutable counter
// such that we can incrementally append it
// it will return us the new tree
// this requires using path copying method
// we already do this because during the expansion
// this results in a new root
// then you can combine this such that during an insertion or multiple insertions into datascript DB
// you also get a new counter (which is acquired via new root)
// that is only way i can see us figuring this out..
// the array method is bad which resutls in O(n) mutation and querying as it depends on copying the whole array each time
// the result is that we first need an immutable js-resource-counter lol

interface NodeTransactionI<linkOpen, linkClose, data> {
  reserveNodeId (): NodeId;
  insertNode (
    NodeId,
    NodeLevel,
    linkOpen,
    linkClose,
    data
  ): Node<data, linkOpen, linkClose>;
  deleteNode (
    NodeId
  ): ?Node<data, linkOpen, linkClose>;
  updateNode (
    NodeId,
    $Shape<Node<data, linkOpen, linkClose>>
  ): ?Node<data, linkOpen, linkClose>;
  searchNodes<k: $Keys<Node<data, linkOpen, linkClose>>> (
    k,
    $ElementType<Node<data, linkOpen, linkClose>, k>
  ): Array<Node<data, linkOpen, linkClose>>;
}

interface NodeDatabaseI<linkOpen, linkClose, data> {
  transactionStart (): NodeTransactionI<linkOpen, linkClose, data>;
  transactionResolve (
    NodeTransactionI<linkOpen, linkClose, data>
  ): NodeDatabaseI<linkOpen, linkClose, data>;
  searchNodes<k: $Keys<Node<data, linkOpen, linkClose>>> (
    k,
    $ElementType<Node<data, linkOpen, linkClose>, k>
  ): Array<Node<data, linkOpen, linkClose>>;
}

export type { NodeId, NodeLevel, Node, NodeImmutableProps, NodeTransactionI, NodeDatabaseI };
