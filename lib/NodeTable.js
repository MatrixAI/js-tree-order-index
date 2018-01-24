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
  acquireNodeId (): NodeId;
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
  deleteNode (
    NodeId
  ): ?[
    Node<data, linkOpen, linkClose>,
    NodeTableI<data, linkOpen, linkClose>
  ];
  deleteNodes (
    Array<NodeId>
  ): ?[
    Array<Node<data, linkOpen, linkClose>>,
    NodeTableI<data, linkOpen, linkClose>
  ];
  updateNode (
    NodeId,
    ?data,
    ?NodeLevel,
    ?linkOpen,
    ?linkClose
  ): [
    Node<data, linkOpen, linkClose>,
    NodeTableI<data, linkOpen, linkClose>
  ];
  updateNodes (
    Array<[
      NodeId,
      ?data,
      ?NodeLevel,
      ?linkOpen,
      ?linkClose
    ]>
  ): [
    Array<Node<data, linkOpen, linkClose>>,
    NodeTableI<data, linkOpen, linkClose>
  ];
  searchNodes<k: $Keys<Node<data, linkOpen, linkClose>>> (
    k,
    $ElementType<Node<data, linkOpen, linkClose>, k>
  ): Array<Node<data, linkOpen, linkClose>>;
}

export type { NodeId, NodeLevel, Node, NodeTableI };
