// @flow

type NodeId = number;
type NodeLevel = number;

type Node<linkOpen: Object, linkClose: Object, data: Object> =
  { id: NodeId, level: NodeLevel } &
  linkOpen &
  linkClose &
  data;

interface NodeTableI<linkOpen, linkClose, data> {
  insertNode (
    NodeLevel,
    linkOpen,
    linkClose,
    data,
    ?(NodeId) => any
  ): [
    Node<linkOpen, linkClose, data>,
    NodeTableI<linkOpen, linkClose, data>
  ];
  deleteNode (
    NodeId
  ): [
    ?Node<linkOpen, linkClose, data>,
    NodeTableI<linkOpen, linkClose, data>
  ];
  updateNode (
    NodeId,
    $Shape<Node<linkOpen, linkClose, data>>
  ): [
    ?Node<linkOpen, linkClose, data>,
    NodeTableI<linkOpen, linkClose, data>
  ];
  getNode (NodeId): ?Node<linkOpen, linkClose, data>;
  getNodes (): Array<Node<linkOpen, linkClose, data>>;
  searchNodes<k: $Keys<Node<linkOpen, linkClose, data>>> (
    k,
    $ElementType<Node<linkOpen, linkClose, data>, k>
  ): Array<Node<linkOpen, linkClose, data>>;
  loadNodes (
    Array<[NodeLevel, linkOpen, linkClose, data, ?(NodeId) => any]>
  ): [
    Array<Node<linkOpen, linkClose, data>>,
    NodeTableI<linkOpen, linkClose, data>
  ];
  transaction (
    callback: (NodeTableTransaction<linkOpen, linkClose, data>) => any
  ): NodeTableI<linkOpen, linkClose, data>;
}

type NodeTableTransaction<linkOpen, linkClose, data> = {
  insertNode (
    NodeLevel,
    linkOpen,
    linkClose,
    data,
    ?(NodeId) => any
  ): Node<linkOpen, linkClose, data>;
  deleteNode (
    NodeId
  ): ?Node<linkOpen, linkClose, data>;
  updateNode (
    NodeId,
    $Shape<Node<linkOpen, linkClose, data>>
  ): ?Node<linkOpen, linkClose, data>;
  getNode (NodeId): ?Node<linkOpen, linkClose, data>;
  getNodes (): Array<Node<linkOpen, linkClose, data>>;
  searchNodes<k: $Keys<Node<linkOpen, linkClose, data>>> (
    k,
    $ElementType<Node<linkOpen, linkClose, data>, k>
  ): Array<Node<linkOpen, linkClose, data>>;
  loadNodes (
    Array<[NodeLevel, linkOpen, linkClose, data, ?(NodeId) => any]>
  ): Array<Node<linkOpen, linkClose, data>>;
};

export type { NodeId, NodeLevel, Node, NodeTableI, NodeTableTransaction };
