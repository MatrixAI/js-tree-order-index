// @flow

import type { NodeId, NodeLevel, Node, NodeTableI } from '../NodeTable.js';

import ds from 'datascript';
import { CounterImmutable } from 'resource-counter';
import { Map as MapI } from 'immutable';

type ConstructNew = {
  new: true,
  keysOrdered: Array<$Keys<Node<data, linkOpen, linkClose>>>,
  keysUnordered: Array<$Keys<Node<data, linkOpen, linkClose>>>, // these must contain only keys of objects
  indexTagSuffix: string
};

type ConstructClone = {
  new: false,
  db: Object,
  indexTagKeys: Set<$Keys<Node<data, linkOpen, linkClose>>>,
  indexTagSuffix: string,
  indexTagCounter: CounterImmutable,
  indexTags: MapI<any, number>
};

type ConstructConfig = ConstructNew | ConstructClone;

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

  // we should make this mutable
  // so we can have node with any data
  // and mutate the object
  // so we are saying that actually we can have any object
  // cause we can just acquiring them...
  // but our flow types prevents this unfortunately

  _indexTagKeys: Set<$Keys<Node<data, linkOpen, linkClose>>>;
  _indexTagSuffix: string;
  _indexTagCounter: CounterImmutable;
  _indexTags: MapI<Object, number>;

  constructor (
    config: ConstructConfig
  ) {
    if (config.new) {
      const schema = {};
      for (let key of config.keysOrdered) {
        schema[key] = {':db/index': true};
      }
      for (let key of config.keysUnordered) {
        schema[key + config.indexTagSuffix] = {':db/index': true};
      }
      this._db = ds.empty_db(schema);
      this._indexTagKeys = new Set(config.keysUnordered);
      this._indexTagSuffix = config.indexTagSuffix;
      this._indexTagCounter = new CounterImmutable;
      this._indexTags = MapI();
    } else {
      this._db = config.db;
      this._indexTagKeys = config.indexTagKeys;
      this._indexTagSuffix = config.indexTagSuffix;
      this._indexTagCounter = config.indexTagCounter;
      this._indexTags = config.indexTags;
    }
  }

  insertNode (
    level: NodeLevel,
    linkOpen: linkOpen,
    linkClose: linkClose,
    data: data,
    callbackWithId: (NodeId) => any
  ): [
    Node<data, linkOpen, linkClose>,
    NodeDataScript<data, linkOpen, linkClose>
  ] {
    const conn = ds.conn_from_db(this._db);
    const nodeInserted = {
      ...linkOpen,
      ...linkClose,
      ...data,
      level: level
    };
    let indexTags;
    const indexTagCounter = this._indexTagCounter.transaction((ct) => {
      indexTags = this._indexTags.withMutations((it) => {
        this._indexTagKeys.forEach((key) => {
          if (nodeInserted.hasOwnProperty(key)) {
            const tag = ct.allocate();
            it.set(nodeInserted[key], tag);
            nodeInserted[key + this._indexTagSuffix] = tag;
          }
        });
      });
    });
    const report = ds.transact(conn, [{
      ...nodeInserted,
      ':db/id': -1
    }]);
    const id = ds.resolve_tempid(report.tempids, -1);
    callbackWithId(id);
    const db = ds.db(conn);
    const nodeTable = new NodeDataScript({
      new: false,
      db: db,
      indexTagKeys: this._indexTagKeys,
      indexTagSuffix: this._indexTagSuffix,
      indexTagCounter: indexTagCounter,
      indexTags: indexTags
    });
    return [
      {
        ...linkOpen,
        ...linkClose,
        ...data,
        level: level,
        id: id
      },
      nodeTable
    ];
  }

  deleteNode (
    id: NodeId
  ): [
    ?Node<data, linkOpen, linkClose>,
    NodeDataScript<data, linkOpen, linkClose>
  ] {
    const entity = ds.entity(this._db, id);
    if (entity.key_set().length) {
      let nodeDeleted = {};
      let indexTags;
      const indexTagCounter = this._indexTagCounter.transaction((ct) => {
        indexTags = this._indexTags.withMutations((it) => {
          for (let [key, value] of entity.entry_set()) {
            nodeDeleted[key] = value;
            if (this._indexTagKeys.has(key)) {
              const tag = this._indexTags.get(value);
              if (tag) {
                ct.deallocate(tag);
                it.delete(value);
              }
            }
          }
        });
      });
      this._indexTagKeys.forEach((key) => {
        delete nodeDeleted[key + this._indexTagSuffix];
      });
      nodeDeleted['id'] = id;
      const db = ds.db_with(
        this._db,
        [[':db.fn/retractEntity', id]]
      );
      const nodeTable = new NodeDataScript({
        new: false,
        db: db,
        indexTagKeys: this._indexTagKeys,
        indexTagSuffix: this._indexTagSuffix,
        indexTagCounter: indexTagCounter,
        indexTags: indexTags
      });
      return [nodeDeleted, nodeTable];
    } else {
      return [null, this];
    }
  }

  updateNode (
    id: NodeId,
    nodeUpdate: $Shape<Node<data, linkOpen, linkClose>>
  ): [
    ?Node<data, linkOpen, linkClose>,
    NodeTable<data, linkOpen, linkClose>
  ] {
    const nodeUpdate_ = {...nodeUpdate};
    const entity = ds.entity(this._db, id);
    if (entity.key_set().length) {
      let indexTags;
      const indexTagCounter = this._indexTagCounter.transaction((ct) => {
        indexTags = this._indexTags.withMutations((it) => {
          for (let key of this._indexTagKeys) {
            if (nodeUpdate_.hasOwnProperty(key)) {
              const objOrig = entity.get(key);
              const objNew = nodeUpdate_[key];
              let tag = it.get(key);
              // if entity has a key in indexTagKeys
              // the tag must exist in the indexTags
              if (tag && objOrig) {
                it.delete(objOrig);
              } else {
                tag = ct.allocate();
              }
              it.set(objNew, tag);
              nodeUpdate_[key + this._indexTagSuffix] = tag;
            }
          }
        });
      });
      const db = ds.db_with(
        this._db,
        [{
          ...nodeUpdate_,
          ':db/id': id
        }]
      );
      const nodeUpdated = {};
      const entityNew = ds.entity(db, id);
      for (let [key, value] of entityNew.entry_set()) {
        nodeUpdated[key] = value;
      }
      this._indexTagKeys.forEach((key) => {
        delete nodeUpdated[key + this._indexTagSuffix];
      });
      const nodeTable = new NodeDataScript({
        new: false,
        db: db,
        indexTagKeys: this._indexTagKeys,
        indexTagSuffix: this._indexTagSuffix,
        indexTagCounter: indexTagCounter,
        indexTags: indexTags
      });
      return [nodeUpdated, nodeTable];
    } else {
      return [null, this];
    }
  }

  searchNodes<k: $Keys<Node<data, linkOpen, linkClose>>> (
    key: k,
    value: $ElementType<Node<data, linkOpen, linkClose>, k>
  ): Array<Node<data, linkOpen, linkClose>> {
    const results = ds.q(
      '[:find (pull ?e [*]) :in $ [?key ?value] :where [?e ?key ?value]]',
      this.db,
      [key, value]
    );
    return results.map(([result]) => {
      this._indexTagKeys.forEach((key) => {
        delete result[key + this._indexTagSuffix];
      });
      return result;
    });
  }

  transaction (callback) {


    const conn = ds.conn_from_db(this._db);
    let indexTags;
    const indexTagCounter = this._indexTagCounter.transaction((ct) => {
      indexTags = this._indexTags.withMutations((it) => {

        // and then use them all here
        // it mutations, ct mutations
        // conn mutations as well

      });
    });

    // to get back your original db at the end
    // along iwth new stuff
    // ds.db(conn);

    // do a batch operations here
    // define the set of operations
    // need to define transactions for each one
  }

}

export default NodeDataScript;

export type { ConstructConfig };
