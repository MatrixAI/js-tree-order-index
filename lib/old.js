class Block<child> {

  _levelDelta: number;
  _parentNode: ?Node;
  _children: Array<child>;
  _lastIndex: ?number;

  constructor (
    blockSize: number,
    levelDelta: number,
    parentNode: ?Node,
    children: ?Array<child>
  ) {
    this._levelDelta = levelDelta;
    this._parentNode = parentNode;
    if (children && children.length > 1) {
      this._children = children;
      this._children.length = blockSize;
      this._lastIndex = children.length - 1;
    } else {
      this._children = new Array(blockSize);
      this._lastIndex = null;
    }
  }

  [Symbol.iterator] (): Iterator<[number, child]> {
    return this._children.entries();
  }

  getParent (): ?Node {
    return this._parentNode;
  }

  getChildren (): Array<children> {
    return this._children;
  }

  getChildrenLength (): number {
    if (this._lastIndex != null) {
      return this._lastIndex + 1;
    } else {
      return 0;
    }
  }

  getChildByIndex (index: number): ?child {
    return this._children[index];
  }

}

class Leaf extends Block<{key: number, entry: OrderEntry}> {

  _gapSize: number;
  _nodeTable: NodeTableI<GapLink<Leaf>, *>;
  _leafNext: ?Leaf;
  _leafPrev: ?Leaf;

  constructor (
    blockSize: number,
    levelDelta: number = 0,
    parentNode: ?Node,
    children: ?Array<{key: number, entry: OrderEntry}>,
    nodeTable: NodeTableI<GapLink<Leaf>, *>,
    leafNext: Leaf = null,
    leafPrev: Leaf = null
  ) {
    super(blockSize, levelDelta, parentNode, children);
    this._gapSize = Math.floor(Number.MAX_SAFE_INTEGER / blockSize + 1);
    this._nodeTable = nodeTable;
    this._leafNext = leafNext;
    this._leafPrev = leafPrev;
  }

  getLeafFirst (): Leaf {
    return this;
  }

  getLeafLast (): Leaf {
    return this;
  }

  getLeafNext (): ?Leaf {
    return this._leafNext;
  }

  setLeafNext (leafNext: Leaf): void {
    this._leafNext = leafNext;
    return;
  }

  getLeafPrev (): ?Leaf {
    return this._leafPrev;
  }

  setLeafPrev (leafPrev: Leaf): void {
    this._leafPrev = leafPrev;
    return;
  }

  getChildByKey (key: number): ?[number, OrderEntry] {
    if (this._lastIndex == null) {
      return null;
    }
    const [index, cost] = interpolationSearch(
      key,
      this._lastIndex + 1,
      (index) => this._children[index].key
    );
    if (cost > Math.log2(this._children.length)) {
      this._relabelGapKeys();
    }
    if (index != null) {
      return [index, this._children[index].entry];
    }
    return null;
  }

  // rebalancing is strange
  // as we can do merging and splitting of blocks
  // merging blocks requires relabelling the gap keys
  // but splitting blocks doesn't
  _rebalance () {

  }

  insertEntry (
    orderEntry: OrderEntry,
    position: number
  ): [
    {key: number, entry: OrderEntry},
    Leaf,
    number
  ] {



    // the position number means where we want to insert it
    // we want to insert a single entry
    // somewhere according to position
    // but if there are

    if (this._lastIndex + 1 === blockSize) {

      // blocksize is full

      position = boundIndex(position, this._lastIndex);

      // length + 1 due to the new entry
      // deal with odd (length + 1) by leaving more on the left
      // and less on the right
      // convert it to an index by minusing 1
      const splitIndex = Math.ceil((this._children.length + 1) / 2) - 1;

      // the gapkeys may be the same
      // or what...?
      // ok we do need to work  this out

      const childPrev = this._children[position - 1];
      const childNext = this._children[position];
      let newGapKey;
      if (childPrev && childNext) {
        newGapKey = Math.floor((childPrev.key + childNext.key) / 2);
      } else if (childPrev) {
        newGapKey = Math.floor((childPrev.key + Number.MAX_SAFE_INTEGER) / 2);
      } else if (nextEntry) {
        newGapKey = Math.floor((0 + Number.MAX_SAFE_INTEGER) / 2);
      }

      if (position === splitIndex) {
        // new entry is on the right most of the left split
        // gapkey check only checks if childPrev
        if (childPrev && (newGapKey === childPrev.key)) {
          // relabel!
        }
      } else if (position + 1 === splitIndex) {
        // new entry is on the left most of the right split
        if (childNext && (newGapKey === childNext.key)) {
          // relabel!
        }
      } else {
        if (
          (childPrev && (newGapKey === childPrev.key)) ||
          (childNext && (newGapKey === childNext.key))
        ) {
          this._relabelGapKeys();
        }
      }

      // if we are on the splitIndex
      // we don't need to care about a particular element


      // we now know where it should be if we could insert it
      // note that inserting in the middle may still require relabelling the gap keys

      const newLeaf = new Leaf(
        this._nodeTable,
        this._children.length,
        0,
        this._parentNode,
      );
      this._nextLeaf = newLeaf; // not sure how to do this recursively yet
      this._parent.insertChild(newLeaf); // somehow we need to do this

      // then you fill out the newLeaf's internal elements
      // during construction
      // cause you now know

      // the main idea is we have to know where this would be inserted if it could be inserted
      // and do we relabel the gap keys at all?
      // only if we need to, otherwise it's not a problem


      const newChildren = array.slice(splitIndex);
      this._children.fill(undefined, splitIndex);





      // split tree!
      // how do we split
      // we already know where the record must go
      // it is specified by position here and we are in the leaf
      // split the bucket
      // original node has [L+1]/2 items (ceil)
      // new node has L+1/2 (floor)
      // where L is the number of records
      // if 10 items 10 + 1 = 11
      // 11 / 2 = 5.5 => 6
      // 11 / 2 = 5.5 => 5
      // move the
      // 10 + 1 (1 new element)



    } else {
      position = boundIndex(position, this._lastIndex);
      const childPrev = this._children[position - 1];
      const childNext = this._children[position];
      let newGapKey;
      if (childPrev && childNext) {
        newGapKey = Math.floor((childPrev.key + childNext.key) / 2);
      } else if (childPrev) {
        newGapKey = Math.floor((childPrev.key + Number.MAX_SAFE_INTEGER) / 2);
      } else if (nextEntry) {
        newGapKey = Math.floor((0 + Number.MAX_SAFE_INTEGER) / 2);
      } else {
        newGapKey = this._gapSize;
      }
      if (
        (childPrev && (newGapKey === childPrev.key)) ||
        (childNext && (newGapKey === childNext.key))
      ) {
        this._relabelGapKeys();
        return this.insertEntry(entry, position);
      }

      // when inserting an order entry into the order index
      // we expect that the entry already has a node id
      // where the node id leads us to the table
      // however the table expects that new nodes when inserted
      // already have the correct links
      // that is the links into the order index
      // thus assuming that the entries are already inserted into
      // so it's a chicken or egg problem
      // right now insertion into the node table requires links
      // but to have links you need entries
      // but to insert an entry, you need to update its links to point to the entry
      // what we need to do is to abstract this synchronisation
      // that is inserting into order index shouldn't require that the entry has a valid
      // node id with valid links to the order entry
      // and insertion in to node table shouldn't require that the links are preformed
      // so we do that, and then what happens?

      if (this._updateLink(orderEntry, this, newGapKey)) {
        this._children.splice(position, 0, [newGapKey, orderEntry]);
      } else {
        throw new Error('OrderIndex has an entry that does not exist in the NodeTable');
      }
    }
    return;
  }

  // can we separate this out into 2 loops
  // one that relabels the gapkeys
  // and one that relabels the gaplinks?
  _relabelGapKeys (): void {
    for (
      let i = 0, newGapKey = this._gapSize;
      i < this._lastIndex;
      ++i, newGapKey += this._gapSize
    ) {
      const child = this._children[i];
      child.key = newGapKey;
      if (child.entry.status) {
        this._updateLink(child.entry.id, [this, newGapKey]);
      } else {
        this._updateLink(child.entry.id, null, [this, newGapKey]);
      }
    }
    return;
  }

}

class Node extends Block<Leaf | Node> {

  constructor (
    blockSize: number,
    levelDelta: number = 0,
    parentNode: ?Node,
    children: ?Array<Leaf | Node>,
  ) {
    super(blockSize, levelDelta, parentNode, children);
  }

  getLeafFirst (): Leaf {
    const leaf = this._children[0];
    if (!leaf) {
      throw new Error('Node must always contain a first child');
    } else {
      return leaf.getLeafFirst();
    }
  }

  getLeafLast (): Leaf {
    if (!this._lastIndex) {
      throw new Error('Node must always contain a last child');
    }
    return this._children[this._lastIndex].getLeafLast();
  }

}
