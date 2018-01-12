// @flow

class ArrayFixed extends Array {
  count: number;
  constructor (size: number) {
    this.count = 0;
    super(size);
  }
}
class ArrayFixed extends Array {
  constructor (size) {
    super(size);
    this.count = 0;
  }
  // we need to override the push
  // and provide special set functions
  set (index) {
    // if the it's already undefined
    // then you can set it
  }
  push (index) {

  }
  // wwhat about splicign?
  // we should use a JSperf test to test if we can do this on PERFi nstead
  // but we have to deal with push and shit
  // and deal withthe actual count of elements
  // and we have to deal with the fact that the number of elements may not even start at the begggining
  // we need to consider what happens when we splice as well!?
}

// when you assign an element
// you need to increment the count
// when you decrement an element
// you need to decrement the count
// but the count needs not be set if you just reassigned an element
// also note that set works by doing
// so i don't think you can ovverride a get

/**
 * A simple monadic nullable bind.
 * Note that the maybe value can be null or undefined or the actual value.
 */
function bindNull<a, b> (maybe: ?a, action: (a) => ?b) {
  if (maybe != null) {
    return action(maybe);
  } else {
    return null;
  }
}

function leastCommonAncestor<node> (
  node1: node,
  node2: node,
  getParent: (node) => ?node
): [node, node, node] {
  if (node1 === node2) {
    return node1;
  }
  // unshift is orders of magnitude slower than push and pop
  // reverse iteration doesn't work for multiple arrays
  let nodePath1 = [node1];
  let nodePath2 = [node2];
  while (node1) {
    node1 = getParent(node1);
    nodePath1.push(node1);
  }
  while (node2) {
    node1 = getParent(node2);
    nodePath2.push(node2);
  }
  let lca;
  let previousNode;
  node1 = nodePath1.pop();
  node2 = nodePath2.pop();
  while (node1 && node2) {
    if (node1 !== node2) {
      lca = previousNodeCheck;
      break;
    }
    previousNode = node1;
    node1 = nodePath1.pop();
    node2 = nodePath2.pop();
  }
  if (!lca) {
    throw RangeError('Nodes are not in the same tree');
  }
  return [lca, node1, node2];
}

/**
 * Perform interpolation search on an array assumed to contain mostly equally
 * spaced out values that are in-order and also unique.
 * We calculate a ratio mapping the value space to the key space.
 * Multiple the ratio by the search value's position in the value space.
 * If we haven't found the value, partition the search space according to
 * order, and then reiterate.
 */
function interpolationSearch (
  searchValue: number,
  arrayLength: number,
  probeValue: (number) => number
): [?number, number] {
  let keyLow = 0;
  let keyHigh = arrayLength - 1;
  let cost = 0;
  while (
    (keyLow <= keyHigh) &&
    (searchValue >= probeValue(keyLow)) &&
    (searchValue <= probeValue(keyHigh))
  ) {
    let keySpace = keyHigh - keyLow;
    let valueSpace = probeValue(keyHigh) - probeValue(keyLow);
    let spaceMappingRatio = keySpace / valueSpace;
    let valuePosition = searchValue - probeValue(keyLow);
    let probeKey = Math.trunc(valuePosition * spaceMappingRatio + keyLow);
    if (searchValue === probeValue(probeKey)) {
      return [probeKey, cost];
    }
    if (searchValue > probeValue(probeKey)) {
      keyLow = probeKey + 1;
    } else {
      keyHigh = probeKey - 1;
    }
    ++cost;
  }
  return [null, cost];
}

/**
 * Bound a positive and negative (in-between) position index.
 * For example:
 *   indexes:       0  1
 *   elements:    [ E1 E2 ]
 *   position+:    0  1  2
 *   position-:   -3 -2 -1
 * The JS splice function already does bounding, however it starts -1 at:
 *   splice:      -2 -1
 */
function boundIndex (
  position: number,
  lastIndex: number,
  shift: boolean = true
) {
  if (lastIndex < 0) throw RangeError('lastIndex cannot be less than 0');
  if (position < 0) {
    const lastIndexNegative = -(lastIndex + 2);
    if (position < lastIndexNegative) {
      position = lastIndexNegative;
    }
  } else if (position > lastIndex) {
    position = lastIndex + 1;
  }
  if (shift && position < 0) {
    position += lastIndex + 2;
  }
  return position;
}

export { ArrayFixed, bindNull, leastCommonAncestor, interpolationSearch, boundIndex };
