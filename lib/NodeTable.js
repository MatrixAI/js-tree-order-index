// @flow

type NodeId = number;
type NodeLevel = number;

type Node<linkOpen: Object, linkClose: Object, data: Object> = {|
  ...{| id: NodeId, level: NodeLevel |},
  ...linkOpen,
  ...linkClose
  ...data
|};

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
