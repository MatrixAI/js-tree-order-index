//@flow

type Node<link, data> =
  {
    id: number,
    opening: link,
    closing: link,
    level: number,
  } & data;

interface NodeTableI<link: OrderLinkI, data: Object> {
  insertNode (data, ?link, ?link, ?number): [number, Node<link, data>];
  getNodeById (number): ?Node<link, data>;
  deleteNodeById (number): any;
}

export type { NodeTableI, Node };
