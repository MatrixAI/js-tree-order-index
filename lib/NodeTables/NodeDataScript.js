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
    let indexTags = this._indexTags;
    const indexTagCounter = this._indexTagCounter.transaction((ct) => {
      this._indexTagKeys.forEach((key) => {
        if (nodeInserted.hasOwnProperty(key)) {
          const assigned = ct.allocate();
          indexTags = indexTags.set(nodeInserted[key], assigned);
          nodeInserted[key + this._indexTagSuffix] = assigned;
        }
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
        indexTags = this._indexTags.withMutations((mt) => {
          for (let [key, value] of entity.entry_set()) {
            nodeDeleted[key] = value;
            if (this._indexTagKeys.has(key)) {
              const tag = this._indexTags.get(key);
              if (tag) {
                ct.deallocate(tag);
                mt.delete(key);
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
    node: $Shape<Node<data, linkOpen, linkClose>>
  ): [
    ?Node<data, linkOpen, linkClose>,
    NodeTable<data, linkOpen, linkClose>
  ] {

    // if we update the node, why do we return the fully realised node?
    // it's just a patch to the node
    // we would need to acquire the full node to do so
    // so after we update, we'd need to the full node again
    // so we would update and then query it again
    //
    // if the node didn't exist, return null
    // if the node did exist, return the updated node
    // to do this we must check if the entity exists with
    // with a find query (using a transaction) (we only need the id)
    // then run the update query (using the transaction)
    // and then acquire the node that was updated again
    // but strip it of all the tag keys

    // wait we need to check if this record exists first
    // to check if an entity actually exists, we should be using find
    // problem is that for deleteNode, this returns the node anyway
    // so there's no problem with using the entity api and checking for the keyset
    // but here we just want to
    ds.db_with(
      this._db,
      [{
        ':db/id': id
      }]
    );

    // can we do this within a transaction?

    const conn = ds.conn_from_db(this._db);
    const [idCheck] = ds.q(
      '[:find ?e :in $ ?e where [?e]]',
      this._db,
      id
    );



    if (idCheck) {

    } else {
      return [null, this];
    }


    // should an update expect that the id already exists
    // yes
    // what about an upsert
    // sometimes you want to insert
    // sometimes you want to update
    // sometimes you want to upsert
    // also if this is an update
    // and you don't set everything
    // you're doing a patch
    // not an update
    // PATCH, vs REPLACE
    // replace is a different style
    // where you need to retract and then assert again
    // all within the same transaction
    // here we must update according to id...
    // and it's just based on entities


  }

}

export default NodeDataScript;

export type { ConstructConfig };
