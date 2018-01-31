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

      // wait we have to remove the index

    }


    // when we retract, we also need to pull in all the data first
    // but how do we know if this entity exists first
    // we need to deallocate all of their stuff
    // so we do need to query the data first
    // problem is the pull always pulls just the id itself
    // but what about...?
    // well for some reason, all entries exist all the time
    // we just need to pull the data
    // and check if it has anything other than just the data
    // but what do we actually need
    // we need the FULL SET on this._indexTagKeys
    // and we are deallocating each
    // but what if _indexTagKeys is empty?
    // well then we just need to check everything



    // we need to retract data
    // but how do we do this?
    // ':db/retract' id level value
    // ':db/retract' id linkOpen value
    // ':db/retract' id linkClose value
    // but i don't know what the values are
    // I want to retract based on a query
    // maybe if we can use entity...
    // and then retract based on that

    // get the entity (if it exists)
    // and get its keySet
    // a datom also tells you whether the datom is asserted or retracted


    // ds.db_with(this._db, [':db.fn/retractEntity', id])

    // but hold on, we need to get the value too to retract
    // or maybe it doesn't matter
    // maybe we can just not query it, and just directly retract it?

  }

}

export default NodeDataScript;

export type { ConstructConfig };
