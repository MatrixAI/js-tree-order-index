// @flow

import type { CounterImmutable } from 'object-tagger';
import type { NodeId, NodeLevel, Node, NodeTableI } from '../NodeTable.js';

import ds from 'datascript';
import { TaggerImmutable } from 'object-tagger';
import Reference from 'reference-pointer';

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

class Reference_ extends Reference {};

const objectPrototype = Object.getPrototypeOf({});

/**
 * Class representing a nodetable database.
 * Datascript has peculiar property of copying literal objects that are inserted.
 * This means you cannot insert by-reference for literal objects.
 * There are 2 ways to get around it. You can instead use a class instantiated
 * object, or you can use `Object.create(null)` which creates an object with
 * no constructor. This is because datascript uses `object.constructor` to know
 * whether a variable is of type `Object`. Using a class instantiated object is
 * how we are going to get around this problem. In this case, to make it work
 * even for user-provided objects in the `data` type, we need to wrap all objects
 * in the `Reference` object. This will add an extra unnecessary pointer
 * dereference, until this issue is resolved: https://github.com/tonsky/datascript/issues/248
 * In fact there are 2 things happening here all because Datascript cannot index
 * objects and store objects by reference. That's the tagging and the storing
 * of `Reference`. If we can have an immutable database that has efficient
 * structure sharing, and first-class support for indexing including object indexing
 * then these 2 things would not be required at all!
 * If only NanoSQL would have proper reference-based immutability: https://github.com/ClickSimply/Nano-SQL/issues/19
 * Immutability here is needed to produce stable iterators, and to eventually build
 * MVCC functionality, which would allow one to synchronise asynchronous
 * modifications.
 */
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
    callbackWithId: ?(NodeId) => any
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
    const tagger = this._tagger.tag(nodeInserted_);
    // warp literal objects to prevent datascript copying behaviour
    this._wrapLiteralObjects(nodeInserted_);
    nodeInserted_[':db/id'] = -1;
    const report = ds.transact(conn, [nodeInserted_]);
    const id = ds.resolve_tempid(report.tempids, -1);
    // original nodeInserted now has an id
    nodeInserted.id = id;
    // run callback that requires the id (for maybe synchronisation)
    if (callbackWithId) callbackWithId(id);
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
    const nodeDeleted = ds.pull(this._db, '[*]', id);
    delete nodeDeleted[':db/id'];
    if (Object.keys(nodeDeleted).length) {
      this._unwrapLiteralObjects(nodeDeleted);
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
    const nodeUpdated = ds.pull(this._db, '[*]', id);
    delete nodeUpdated[':db/id'];
    if (Object.keys(nodeUpdated).length) {
      // unwrap before performing the untagging and tagging
      this._unwrapLiteralObjects(nodeUpdated);
      nodeUpdated.id = id;
      let nodeDiff = {}; // replacing values (objects and primitives)
      let nodeReplaced = {}; // replaced values (only objects)
      for (let key of Object.keys(nodePatch)) {
        const valuePatch = nodePatch[key];
        const valueOrig = nodeUpdated[key];
        if (valuePatch !== valueOrig) {
          nodeDiff[key] = valuePatch;
          nodeUpdated[key] = valuePatch;
          if (typeof valueOrig === 'object' || valueOrig === undefined) {
            nodeReplaced[key] = valueOrig;
          }
        }
      }
      this._tagger.strip(nodeUpdated);
      const tagger = this._tagger.transaction((tt) => {
        // untag the objects being replaced
        // allowing their ids to be potentially reused
        tt.untag(nodeReplaced);
        // tag the new objects
        tt.tag(nodeDiff);
      });
      // before we patch, we must wrap in references
      this._wrapLiteralObjects(nodeDiff);
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
    if (typeof value === 'object' || value === undefined) {
      const tag = this._tagger.getTag(key, value);
      if (tag) [keySearch, valueSearch] = tag;
    }
    const results = ds.q(
      '[:find (pull ?e [*]) :in $ [?key ?value] :where [?e ?key ?value]]',
      this._db,
      [keySearch, valueSearch]
    );
    results.forEach(([result], index) => {
      this._unwrapLiteralObjects(result);
      this._tagger.strip(result);
      results[index] = result;
    });
    return results;
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

  _wrapLiteralObjects (object: Object): void {
    for (let [key, value] of Object.entries(object)) {
      // if value is null or undefined, just wrap it
      // but if it is an object, only wrap it if it is a literal object
      // note that `typeof null === 'object'`
      if (
        value === null ||
        value === undefined ||
        (
          typeof value === 'object' &&
          Object.getPrototypeOf(value) === objectPrototype
        )
      ) {
        object[key] = new Reference_(value);
      }
    }
  }

  _unwrapLiteralObjects (object: Object): void {
    for (let [key, value] of Object.entries(object)) {
      // this ensures that only our private reference will be unwrapped
      if (value instanceof Reference_) {
        object[key] = value.get();
      }
    }
  }

}

export default NodeDataScript;
export { CounterImmutable } from 'object-tagger';

export type { ConstructConfig };
