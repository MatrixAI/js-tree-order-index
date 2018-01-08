//@flow

type Node<link, data> =
  {
    id: number,
    level: number,
    opening: ?link,
    closing: ?link,
  } & data;

interface NodeTableI<link: OrderLinkI, data: Object> {
  insertNode (data, number, ?link, ?link): [number, Node<link, data>];
  getNodeById (number): ?Node<link, data>;
  deleteNodeById (number): any;
}

export type { NodeTableI, Node };
