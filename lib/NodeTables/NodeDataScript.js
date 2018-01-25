// @flow

import type { NodeId, NodeLevel, Node, NodeTableI } from '../NodeTable.js';

import ds from 'datascript';
import Counter from 'resource-counter';

const tagSuffix = '-id';

class NodeDataScript<
  data: *,
  linkOpen: *,
  linkClose: *
> implements NodeTableI<
  data,
  linkOpen,
  linkClose
> {

  _db: Object;
  _indexingTagCounter: Counter;
  _indexingTagKeys: Array<$Keys<Node<data, linkOpen, linkClose>>>;
  _indexingTags: WeakMap<any, number>;

  constructor (
    keysOrdered: Array<$Keys<Node<data, linkOpen, linkClose>>>, // keys that are ordered
    keysUnordered: Array<$Keys<Node<data, linkOpen, linkClose>>> // keys that are unordered
  ) {
    const schema = {};
    for (let key of keysOrdered) {
      schema[key] = {':db/index': true};
    }
    for (let key of keysUnordered) {
      schema[key + tagSuffix] = {':db/index': true};
    }
    this._db = d.empty_db(schema);
    this._indexingTagKeys = keysUnordered;
    this._indexingTags = new WeakMap;
    this._indexingTagCounter = new Counter;
  }

}

export default NodeDataScript;
