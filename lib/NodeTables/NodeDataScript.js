// @flow

import type { NodeId, NodeLevel, Node, NodeTableI } from '../NodeTable.js';

import ds from 'datascript';
import { CounterImmutable } from 'resource-counter';
import { Map as MapI } from 'immutable';
import Reference from 'reference-pointer';

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

class Tagger {

  _tagKeys: Set<string>;
  _tagSuffix: string;
  _tagCounter: CounterImmutable;
  _tagMap: MapI<Object, [number, number]>;

  constructor (tagKeys, tagSuffix, tagCounter, tagMap) {
    this._tagKeys = tagKeys;
    this._tagSuffix = tagSuffix;
    this._tagCounter = tagCounter;
    this._tagMap = tagMap;
  }

  setTagKeys (tagKeys: Set<string>): Tagger {
    return new Tagger(
      tagKeys,
      this._tagSuffix,
      this._tagCounter,
      this._tagMap
    );
  }

  tag (object: {[string]: any}): Tagger {
    let tagCounter, tagMap;
    tagCounter = this._tagCounter.transaction((counter) => {
      tagMap = this._tagMap.withMutations((map) => {
        this._tagKeys.forEach((key) => {
          if (object.hasOwnProperty(key)) {
            const objectTagged = object[key];
            const tagAndCount = map.get(objectTagged);
            let tag;
            if (tagAndCount) {
              tag = tagAndCount[0];
              map.set(objectTagged, [tag, tagAndCount[1] + 1])
            } else {
              tag = counter.allocate();
              map.set(objectTagged, [tag, 1]);
            }
            object[key + this._tagSuffix] = tag;
          }
        });
      });
    });
    return new Tagger(
      this._tagKeys,
      this._tagSuffix,
      tagCounter,
      tagMap
    );
  }

  stripTags (object: {[string]: any}): void {
    this._tagKeys.forEach((key) => {
      delete object[key + this._tagSuffix];
    });
    return object;
  }

  untag (object: {[string]: any}): Tagger {
    let tagCounter, tagMap;
    tagCounter = this._tagCounter.transaction((counter) => {
      tagMap = this._tagMap.withMutations((map) => {
        this._tagKeys.forEach((key) => {
          if (object.hasOwnProperty(key)) {
            const objectTagged = object[key];
            const tagAndCount = map.get(objectTagged);
            if (tagAndCount) {
              if ((tagAndCount[1] - 1) < 1) {
                counter.deallocate(tagAndCount[0]);
                map.delete(objectTagged);
              } else {
                map.set(objectTagged, [tagAndCount[0], tagAndCount[1] - 1]);
              }
            }
            delete object[key + this._tagSuffix];
          }
        });
      });
    });
    return new Tagger(
      this._tagKeys,
      this._tagSuffix,
      tagCounter,
      tagMap
    );
  }

}

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

  // we should just be using a prefix to prefix all other data fields
  // that's all...
  // but wait, we are also saying that id can be used

  // can id be really used by iteslf
  // or should other data
  // but they must all exist within 1 node
  // so yea...
  // so it should be able to work directly
  // so there's no poinnt

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

  // what happens when you update a row
  // and you have set the same objects
  // here it says that you would need
  // to tag it and increase its count
  // because you are apparently saying
  // that you are increasing the number of things
  // using the same object
  // but that's not true
  // in fact
  // this is only really used for the situation
  // where the there are multiple rows using the same object
  // or multiple columns using the same object
  // if we are updating an existing row
  // and that existing row already had an object
  // then we are doing anything new here
  // tagging that object should only happen then for
  // keys that point to objects that DON'T already exist in the existing row
  // if an updating key is pointing to an object that already exists in the correspoinding key for the row, and these are the same objects
  // we don't want to increase the existence count here
  // since it's not actually true to represent another tag here
  // so updating you have to be careful, since you want to say that there are existing objects
  // that you don't actually want to tag

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

  transaction (callback: (NodeTransactionI) => any) {
    const changed = new Reference(false);
    const conn = ds.conn_from_db(this._db);
    let indexTags;
    const indexTagCounter = this._indexTagCounter.transaction((ct) => {
      indexTags = this._indexTags.withMutations((it) => {
        callback(new NodeDataScriptTransaction(
          {

          }
          conn,
          this._indexTagKeys,
          this._indexTagSuffix,
          ct,
          it,
          changed
        ));
      });
    });

    // func >>= (\trans -> return trans(...))

    // the end result is after calling with the callback
    // we need to know if anything changed
    // if anything changed


    if (changed) {
      return new NodeDataScript({
        new: false,
        db: ds.db(conn),
        indexTagKeys: this._indexTagKeys,
        indexTagSuffix: this._indexTagSuffix,
        indexTagCounter: indexTagCounter,
        indexTags: indexTags
      });
    } else {
      return this;
    }
  }

}

class NodeDataScriptTransaction<
  data: *,
  linkOpen: *,
  linkClose: *
> implements NodeTransactionI<
  data,
  linkOpen,
  linkClose
> {

  // by creating the references explicitly, we can now deal with it properly
  // this allows us to define these things outside of the main thing
  // and to create an interface for the transaction object
  // but also... our functions is specialised
  // we don't have an immutable one doing this as well
  // and shouldn't be we doing this explicitly
  // no cause we need the connection and then... to have that connection be fetchable

  _db: Object;
  _indexTagKeys: Set<$Keys<Node<data, linkOpen, linkClose>>>;
  _indexTagSuffix: string;
  _indexTagCounter: CounterTransaction;
  _indexTags: MapI<Object, number>;
  _changed: Reference<boolean>;

  constructor (
    db,
    indexTagKeys,
    indexTagSuffix,
    indexTagCounter,
    indexTags,
    changed
  ) {
    this._db = db;
    this._indexTagKeys = indexTagKeys;
    this._indexTagSuffix = indexTagSuffix;
    this._indexTagCounter = indexTagCounter;
    this._indexTags = indexTags;
    this._changed = changed;
  }

  insertNode (
    level: NodeLevel,
    linkOpen: linkOpen,
    linkClose: linkClose,
    data: data,
    callbackWithId: (NodeId) => any
  ): Node<data, linkOpen, linkClose> {

    const nodeInserted = {
      ...linkOpen,
      ...linkClose,
      ...data,
      level: level
    };

    // we need to add in new keys if necessary

    this._indexTagKeys.forEach((key) => {
      if (nodeInserted.hasOwnProperty(key)) {
        const tag = this._indexTagCounter.allocate();
        this._indexTags.set(nodeInserted[key], tag);
      }
    });




  }


  deleteNode (id: NodeId): ?Node<data, linkOpen, linkClose> {

  }

  updateNode (
    id: NodeId,
    nodeUpdate: $Shape<Node<data, linkOpen, linkClose>>
  ): ?Node<data, linkOpen, linkClose> {

  }

  searchNodes (

  ) {

  }

}

export default NodeDataScript;

export type { ConstructConfig };
