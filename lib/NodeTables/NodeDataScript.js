// @flow

import type { CounterImmutable, TaggerTransaction } from 'object-tagger';
import type {
  NodeId,
  NodeLevel,
  Node,
  NodeTableI,
  NodeTableTransaction
} from '../NodeTable.js';

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

function wrapLiteralObjects (object: Object): void {
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

function unwrapLiteralObjects (object: Object): void {
  for (let [key, value] of Object.entries(object)) {
    // this ensures that only our private reference will be unwrapped
    if (value instanceof Reference_) {
      object[key] = value.get();
    }
  }
}

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
  linkOpen: Object,
  linkClose: Object,
  data: Object
> implements NodeTableI<
  linkOpen,
  linkClose,
  data
> {

  _db: Object;
  _tagger: TaggerImmutable;

  // one of the issues here right now
  // is that one cannot enter NEW data
  // into the system while changing the relevant index
  // we want to be able to enter new data while
  // being able to change the index
  // if we add new index, how is that done?
  // here we only support lookup index
  // which allows one to easily create
  // the system
  // wait schema migration in this case is kind of weird
  // one could decide to bulk load a bunch of nodes instead
  // so that would support bulk insertion

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
    const changed = new Reference(false);
    const conn = ds.conn_from_db(this._db);
    let nodeInserted;
    const tagger = this._tagger.transaction((tt) => {
      nodeInserted = this._insertNode(
        conn,
        tt,
        changed,
        level,
        openLink,
        closeLink,
        dataInserted,
        callbackWithId
      );
    });
    let nodeTable;
    if (changed.get()) {
      nodeTable = new NodeDataScript({
        new: false,
        db: ds.db(conn),
        tagger: tagger
      });
    } else {
      nodeTable = this;
    }
    // $FlowFixMe: nodeInserted is built dynamically
    return [nodeInserted, nodeTable];
  }

  _insertNode (
    conn: Object,
    tagger: TaggerTransaction,
    changed: Reference<boolean>,
    level: NodeLevel,
    openLink: linkOpen,
    closeLink: linkClose,
    dataInserted: data,
    callbackWithId: ?(NodeId) => any
  ): Node<linkOpen, linkClose, data> {
    const nodeInserted = {
      ...openLink,
      ...closeLink,
      ...dataInserted,
      level: level
    };
    // tag, mutate and insert a copy of nodeInserted
    const nodeInserted_ = {...nodeInserted};
    tagger.tag(nodeInserted_);
    // warp literal objects to prevent datascript copying behaviour
    wrapLiteralObjects(nodeInserted_);
    nodeInserted_[':db/id'] = -1;
    const report = ds.transact(conn, [nodeInserted_]);
    const id = ds.resolve_tempid(report.tempids, -1);
    // original nodeInserted now has an id
    nodeInserted.id = id;
    // run callback that requires the id (for maybe synchronisation)
    if (callbackWithId) callbackWithId(id);
    changed.set(true);
    return nodeInserted;
  }

  deleteNode (
    id: NodeId
  ): [
    ?Node<linkOpen, linkClose, data>,
    NodeTableI<linkOpen, linkClose, data>
  ] {
    const changed = new Reference(false);
    const conn = ds.conn_from_db(this._db);
    let nodeDeleted;
    const tagger = this._tagger.transaction((tt) => {
      nodeDeleted = this._deleteNode(
        conn,
        tt,
        changed,
        id
      );
    });
    let nodeTable;
    if (changed.get()) {
      nodeTable = new NodeDataScript({
        new: false,
        db: ds.db(conn),
        tagger: tagger
      });
    } else {
      nodeTable = this;
    }
    return [nodeDeleted, nodeTable];
  }

  _deleteNode (
    conn: Object,
    tagger: TaggerTransaction,
    changed: Reference<boolean>,
    id: NodeId
  ): ?Node<linkOpen, linkClose, data> {
    const nodeDeleted = ds.pull(ds.db(conn), '[*]', id);
    delete nodeDeleted[':db/id'];
    if (Object.keys(nodeDeleted).length) {
      unwrapLiteralObjects(nodeDeleted);
      tagger.untag(nodeDeleted);
      nodeDeleted.id = id;
      ds.transact(conn, [[':db.fn/retractEntity', id]]);
      changed.set(true);
      return nodeDeleted;
    } else {
      return null;
    }
  }

  updateNode (
    id: NodeId,
    nodePatch: $Shape<Node<linkOpen, linkClose, data>>
  ): [
    ?Node<linkOpen, linkClose, data>,
    NodeTableI<linkOpen, linkClose, data>
  ] {
    const changed = new Reference(false);
    const conn = ds.conn_from_db(this._db);
    let nodeUpdated;
    const tagger = this._tagger.transaction((tt) => {
      nodeUpdated = this._updateNode(
        conn,
        tt,
        changed,
        id,
        nodePatch
      );
    });
    let nodeTable;
    if (changed.get()) {
      nodeTable = new NodeDataScript({
        new: false,
        db: ds.db(conn),
        tagger: tagger
      });
    } else {
      nodeTable = this;
    }
    return [nodeUpdated, nodeTable];
  }

  _updateNode (
    conn: Object,
    tagger: TaggerTransaction,
    changed: Reference<boolean>,
    id: NodeId,
    nodePatch: $Shape<Node<linkOpen, linkClose, data>>
  ): ?Node<linkOpen, linkClose, data> {
    const nodeUpdated = ds.pull(ds.db(conn), '[*]', id);
    delete nodeUpdated[':db/id'];
    if (Object.keys(nodeUpdated).length) {
      // unwrap before performing the untagging and tagging
      unwrapLiteralObjects(nodeUpdated);
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
      let nodeTable;
      if (Object.keys(nodeDiff).length) {
        // untag the objects being replaced
        // allowing their ids to be potentially reused
        tagger.untag(nodeReplaced);
        // tag the new objects
        tagger.tag(nodeDiff);
        // before we patch, we must wrap in references
        wrapLiteralObjects(nodeDiff);
        nodeDiff[':db/id'] = id;
        ds.transact(conn, [nodeDiff]);
        changed.set(true);
      }
      tagger.strip(nodeUpdated);
      return nodeUpdated;
    } else {
      return null;
    }
  }

  getNode (id: NodeId): ?Node<linkOpen, linkClose, data> {
    const node = ds.pull(this._db, '[*]', id);
    delete node[':db/id'];
    if (!Object.keys(node).length) {
      return null;
    }
    unwrapLiteralObjects(node);
    this._tagger.strip(node);
    return node;
  }

  _getNode (
    conn: Object,
    tagger: TaggerTransaction,
    id: NodeId
  ): ?Node<linkOpen, linkClose, data> {
    const node = ds.pull(ds.db(conn), '[*]', id);
    delete node[':db/id'];
    if (!Object.keys(node).length) {
      return null;
    }
    unwrapLiteralObjects(node);
    tagger.strip(node);
    node.id = id;
    return node;
  }

  getNodes (): Array<Node<linkOpen, linkClose, data>> {
    const results = ds.q(
      '[:find (pull ?e [*]) :where [?e]]',
      this._db
    );
    results.forEach(([result], index) => {
      unwrapLiteralObjects(result);
      this._tagger.strip(result);
      results[index] = result;
    });
    return results;
  }

  _getNodes (
    conn: Object,
    tagger: TaggerTransaction
  ): Array<Node<linkOpen, linkClose, data>> {
    const results = ds.q(
      '[:find (pull ?e [*]) :where [?e]]',
      ds.db(conn)
    );
    results.forEach(([result], index) => {
      unwrapLiteralObjects(result);
      tagger.strip(result);
      results[index] = result;
    });
    return results;
  }

  searchNodes<k: $Keys<Node<linkOpen, linkClose, data>>> (
    key: k,
    value: $ElementType<Node<linkOpen, linkClose, data>, k>
  ): Array<Node<linkOpen, linkClose, data>> {
    const conn = ds.conn_from_db(this._db);
    let results;
    this._tagger.transaction((tt) => {
      results = this._searchNodes(
        conn,
        tt,
        key,
        value
      );
    });
    // $FlowFixMe: results is built dynamically
    return results;
  }

  _searchNodes<k: $Keys<Node<linkOpen, linkClose, data>>> (
    conn: Object,
    tagger: TaggerTransaction,
    key: k,
    value: $ElementType<Node<linkOpen, linkClose, data>, k>
  ): Array<Node<linkOpen, linkClose, data>> {
    let keySearch = key;
    let valueSearch = value;
    if (typeof value === 'object' || value === undefined) {
      const tag = tagger.getTag(key, value);
      if (tag) [keySearch, valueSearch] = tag;
    }
    const results = ds.q(
      '[:find (pull ?e [*]) :in $ [?key ?value] :where [?e ?key ?value]]',
      ds.db(conn),
      [keySearch, valueSearch]
    );
    results.forEach(([result], index) => {
      unwrapLiteralObjects(result);
      tagger.strip(result);
      results[index] = result;
    });
    return results;
  }

  loadNodes (
    nodeInsertions: Array<[NodeLevel, linkOpen, linkClose, data, ?(NodeId) => any]>
  ): [
    Array<Node<linkOpen, linkClose, data>>,
    NodeTableI<linkOpen, linkClose, data>
  ] {
    const changed = new Reference(false);
    const conn = ds.conn_from_db(this._db);
    let nodesInserted;
    const tagger = this._tagger.transaction((tt) => {
      nodesInserted = this._loadNodes(
        conn,
        tt,
        changed,
        nodeInsertions
      );
    });
    let nodeTable;
    if (changed.get()) {
      nodeTable = new NodeDataScript({
        new: false,
        db: ds.db(conn),
        tagger: tagger
      });
    } else {
      nodeTable = this;
    }
    // $FlowFixMe: nodesInserted is built dynamically
    return [nodesInserted, nodeTable];
  }

  _loadNodes (
    conn: Object,
    tagger: TaggerTransaction,
    changed: Reference<boolean>,
    nodeInsertions: Array<[NodeLevel, linkOpen, linkClose, data, ?(NodeId) => any]>
  ): Array<Node<linkOpen, linkClose, data>> {
    const nodeInserts = [];
    const callbacks = [];
    nodeInsertions.forEach((
      [level, openLink, closeLink, dataInserted, callbackWithId],
      index
    ) => {
      const nodeInserted = {
        ...openLink,
        ...closeLink,
        ...dataInserted,
        level: level
      };
      tagger.tag(nodeInserted);
      wrapLiteralObjects(nodeInserted);
      nodeInserted[':db/id'] = -(index + 1);
      nodeInserts.push(nodeInserted);
      callbacks.push(callbackWithId);
    });
    const report = ds.transact(
      conn,
      nodeInserts
    );
    for (let i = 0; i < nodeInserts.length; ++i) {
      const id = ds.resolve_tempid(report.tempids, -(i + 1));
      delete nodeInserts[i][':db/id'];
      unwrapLiteralObjects(nodeInserts[i]);
      tagger.strip(nodeInserts[i]);
      nodeInserts[i].id = id;
      // $FlowFixMe: callback is checked to exist
      if (callbacks[i]) callbacks[i](id);
    }
    if (nodeInserts.length) changed.set(true);
    return nodeInserts;
  }

  transaction (
    callback: (NodeTableTransaction<linkOpen, linkClose, data>) => any
  ):NodeTableI<linkOpen, linkClose, data> {
    const changed = new Reference(false);
    const conn = ds.conn_from_db(this._db);
    const tagger = this._tagger.transaction((tt) => {
      const nodeTableTransaction = {
        insertNode: (
          level,
          openLink,
          closeLink,
          dataInserted,
          callbackWithId
        ) => this._insertNode(
          conn,
          tt,
          changed,
          level,
          openLink,
          closeLink,
          dataInserted,
          callbackWithId
        ),
        deleteNode: (
          id
        ) => this._deleteNode(
          conn,
          tt,
          changed,
          id
        ),
        updateNode: (
          id,
          nodePatch
        ) => this._updateNode(
          conn,
          tt,
          changed,
          id,
          nodePatch
        ),
        getNode: (id) => this._getNode(
          conn,
          tt,
          id
        ),
        getNodes: () => this._getNodes(
          conn,
          tt
        ),
        searchNodes: (
          key,
          value
        ) => this._searchNodes(
          conn,
          tt,
          key,
          value
        ),
        loadNodes: (
          nodeInsertions
        ) => this._loadNodes(
          conn,
          tt,
          changed,
          nodeInsertions
        )
      };
      callback(nodeTableTransaction);
    });
    if (changed.get()) {
      return new NodeDataScript({
        new: false,
        db: ds.db(conn),
        tagger: tagger
      });
    } else {
      return this;
    }
  }


}

export default NodeDataScript;
export { CounterImmutable } from 'object-tagger';

export type { ConstructConfig };
