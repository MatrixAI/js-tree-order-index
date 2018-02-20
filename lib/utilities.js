// @flow

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

// null means nodes are not the same tree
// [null, node1, node2] means node1 and node2 are the same node
// [nodeAncestor, node1, node2] means nodeAncestor is the ancestor
// and node1 and node2 are their immediate children that is derived from the input node1 and node2
function leastCommonAncestor<node> (
  node1: node,
  node2: node,
  getParent: (node) => ?node
): ?[?node, node, node] {
  if (node1 === node2) {
    return [null, node1, node2];
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
    return null;
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
  valueCount: number,
  probeValue: (number) => number
): [?number, number] {
  let keyLow = 0;
  let keyHigh = valueCount - 1;
  let cost = 0;
  while (
    (keyLow <= keyHigh) &&
    (searchValue >= probeValue(keyLow)) &&
    (searchValue <= probeValue(keyHigh))
  ) {
    const keySpace = keyHigh - keyLow;
    const valueSpace = probeValue(keyHigh) - probeValue(keyLow);
    const spaceMappingRatio = keySpace / valueSpace;
    const valuePosition = searchValue - probeValue(keyLow);
    const probeKey = Math.trunc(valuePosition * spaceMappingRatio + keyLow);
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
  length: number,
  shift: boolean = true
): number {
  if (length === 0) return 0;
  const lastIndex = length - 1;
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

function generateGapKeys (
  length: number,
  keySize: number = Number.MAX_SAFE_INTEGER
): Array<number> {
  const gapSize = Math.floor(keySize / (length + 1));
  const gapKeys = new Array(length);
  for (let i = 0, gapKey = gapSize; i < gapKeys.length; ++i, gapKey += gapSize) {
    gapKeys[i] = gapKey;
  }
  return gapKeys;
}

function generateGapKey (
  length: number,
  leftKey: ?number,
  rightKey: ?number,
  keySize: number = Number.MAX_SAFE_INTEGER
): ?number {
  if (
    (leftKey != null && keySize < leftKey) ||
    (rightKey != null && keySize < rightKey)
  ) {
    throw new RangeError('Gapkey keySize must be bigger than desired gap keys');
  }
  let gapKey;
  if (leftKey != null && rightKey != null) {
    gapKey = Math.floor((leftKey + rightKey) / 2);
  } else if (leftKey != null) {
    gapKey = Math.floor((leftKey + keySize) / 2);
  } else if (rightKey != null){
    gapKey = Math.floor(rightKey / 2);
  } else {
    gapKey = Math.floor(keySize / (length + 1));
  }
  if (
    (leftKey != null && gapKey === leftKey) ||
    (rightKey != null && gapKey === rightKey)
  ) {
    return null;
  }
  return gapKey;
}

// Maybe Int
// Maybe Int

// Nothing, Nothing

// Maybe (Int, Int)
// well the idea is that you want 2 ints

// Just Int, Just Int
// Nothing, Just Int

// Both Int Int | Left Int | Right Int



export { ArrayFixed, bindNull, leastCommonAncestor, interpolationSearch, boundIndex };
