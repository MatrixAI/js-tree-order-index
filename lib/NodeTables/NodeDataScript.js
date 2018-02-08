// @flow

import type { CounterImmutable } from 'object-tagger';
import type { NodeId, NodeLevel, Node, NodeTableI } from '../NodeTable.js';

import ds from 'datascript';
import { TaggerImmutable } from 'object-tagger';

type ConstructNew<linkOpen, linkClose, data> = {
  new: true,
  keysIndexed: Set<$Keys<Node<linkOpen, linkClose, data>>>,
  keysIndexedObjects: Set<$Keys<Node<linkOpen, linkClose, data>>>,
  keysIndexedObjectsTagSuffix: string,
  tagCounter?: CounterImmutable,
};

type ConstructClone = {
  new: false,
  db: Object,
  tagger: TaggerImmutable
};

type ConstructConfig<linkOpen, linkClose, data> =
  ConstructNew<linkOpen, linkClose, data> |
  ConstructClone;

class NodeDataScript<
  linkOpen: *,
  linkClose: *,
  data: *
> implements NodeTableI<
  linkOpen,
  linkClose,
  data
> {

  _db: Object;
  _tagger: TaggerImmutable;

  constructor (
    config: ConstructConfig<linkOpen, linkClose, data>
  ) {
    if (config.new) {
      const schema = {};
      for (let key of config.keysIndexed) {
        schema[key] = {':db/index': true};
      }
      for (let key of config.keysIndexedObjects) {
        schema[key + config.keysIndexedObjectsTagSuffix] = {':db/index': true};
      }
      this._db = ds.empty_db(schema);
      this._tagger = new TaggerImmutable(
        config.keysIndexedObjects,
        config.keysIndexedObjectsTagSuffix,
        config.tagCounter
      );
    } else {
      this._db = config.db;
      this._tagger = config.tagger;
    }
  }

  insertNode (
    level: NodeLevel,
    openLink: linkOpen,
    closeLink: linkClose,
    dataInserted: data,
    callbackWithId: (NodeId) => any
  ): [
    Node<linkOpen, linkClose, data>,
    NodeTableI<linkOpen, linkClose, data>
  ] {
    const conn = ds.conn_from_db(this._db);
    const nodeInserted = {
      ...openLink,
      ...closeLink,
      ...dataInserted,
      level: level
    };
    // tag, mutate and insert a copy of nodeInserted
    const nodeInserted_ = {...nodeInserted};
    nodeInserted_[':db/id'] = -1;
    const tagger = this._tagger.tag(nodeInserted_);
    const report = ds.transact(conn, [nodeInserted_]);
    const id = ds.resolve_tempid(report.tempids, -1);
    // original nodeInserted now has an id
    nodeInserted.id = id;
    // run callback that requires the id (for maybe synchronisation)
    callbackWithId(id);
    const db = ds.db(conn);
    const nodeTable = new NodeDataScript({new: false, db: db, tagger: tagger});
    // nodeInserted is a newly created object
    return [nodeInserted, nodeTable];
  }

  deleteNode (
    id: NodeId
  ): [
    ?Node<linkOpen, linkClose, data>,
    NodeTableI<linkOpen, linkClose, data>
  ] {
    const entity = ds.entity(this._db, id);
    if (entity.key_set().length) {
      let nodeDeleted = {};
      for (let [key, value] of entity.entry_set()) {
        nodeDeleted[key] = value;
      }
      const tagger = this._tagger.untag(nodeDeleted);
      nodeDeleted.id = id;
      const db = ds.db_with(
        this._db,
        [[':db.fn/retractEntity', id]]
      );
      const nodeTable = new NodeDataScript({new: false, db: db, tagger: tagger});
      // $FlowFixMe: nodeDeleted is built dynamically
      return [nodeDeleted, nodeTable];
    } else {
      return [null, this];
    }
  }

  updateNode (
    id: NodeId,
    nodePatch: $Shape<Node<linkOpen, linkClose, data>>
  ): [
    ?Node<linkOpen, linkClose, data>,
    NodeTableI<linkOpen, linkClose, data>
  ] {
    const entity = ds.entity(this._db, id);
    if (entity.key_set().length) {
      let nodeDiff = {}; // replacing values (objects and primitives)
      let nodeReplaced = {}; // replaced values (only objects)
      for (let key of Object.keys(nodePatch)) {
        const valuePatch = nodePatch[key];
        const valueOrig = entity.get(key);
        if (valuePatch !== valueOrig) {
          nodeDiff[key] = valuePatch;
          if (valueOrig instanceof Object) {
            nodeReplaced[key] = valueOrig;
          }
        }
      }
      let nodeUpdated = {...nodeDiff};
      for (let [key, value] of entity.entry_set()) {
        if (
          !nodeDiff.hasOwnProperty(key) &&
          !this._tagger.isTag(key)
        ) {
          nodeUpdated[key] = value;
        }
      }
      const tagger = this._tagger.transaction((tt) => {
        // untag the objects being replaced
        // allowing their ids to be potentially reused
        tt.untag(nodeReplaced);
        // tag the new objects
        tt.tag(nodeDiff);
      });
      nodeDiff[':db/id'] = id;
      const db = ds.db_with(this._db, [nodeDiff]);
      const nodeTable = new NodeDataScript({new: false, db: db, tagger: tagger});
      // $FlowFixMe: nodeUpdated is built dynamically
      return [nodeUpdated, nodeTable];
    } else {
      return [null, this];
    }
  }

  searchNodes<k: $Keys<Node<linkOpen, linkClose, data>>> (
    key: k,
    value: $ElementType<Node<linkOpen, linkClose, data>, k>
  ): Array<Node<linkOpen, linkClose, data>> {
    let keySearch = key;
    let valueSearch = value;
    if (value instanceof Object) {
      const tag = this._tagger.getTag(key, value);
      if (tag) [keySearch, valueSearch] = tag;
    }
    const results = ds.q(
      '[:find (pull ?e [*]) :in $ [?key ?value] :where [?e ?key ?value]]',
      this._db,
      [keySearch, valueSearch]
    );
    return results.map(([result]) => {
      this._tagger.strip(result);
      return result;
    });
  }

  /* transaction (callback: (NodeTransactionI) => any) {
   *   // ok this doesn't actually work yet
   *   const changed = new Reference(false);
   *   const conn = ds.conn_from_db(this._db);
   *   const tagger = this._tagger;
   *   if (changed) {
   *     return new NodeDataScript({
   *       new: false,
   *       db: ds.db(conn),
   *       tagger: tagger
   *     });
   *   } else {
   *     return this;
   *   }
   * }*/

}

export default NodeDataScript;
export { CounterImmutable } from 'object-tagger';

export type { ConstructConfig };
