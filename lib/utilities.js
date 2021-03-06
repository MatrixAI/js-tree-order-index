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
    // $FlowFixMe: nully node1 is dealt with below
    node1 = getParent(node1);
    if (node1) nodePath1.push(node1);
  }
  while (node2) {
    // $FlowFixMe: nully node2 is dealt with below
    node2 = getParent(node2);
    if (node2) nodePath2.push(node2);
  }
  let lca;
  let previousNode;
  node1 = nodePath1.pop();
  node2 = nodePath2.pop();
  while (node1 && node2) {
    // greedily acquire the least common ancestor
    // only when the nodes are not equal with each other
    // then lca is the previousNode
    if (node1 !== node2) {
      lca = previousNode;
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
    // if we have both left and right key
    // we are careting in the middle
    gapKey = Math.floor((leftKey + rightKey) / 2);
  } else if (leftKey != null) {
    // if we have only left key (we are inserting on the right or after the last)
    gapKey = Math.floor((leftKey + keySize) / 2);
  } else if (rightKey != null){
    // if we only have right key (we are inserting on the left)
    gapKey = Math.floor(rightKey / 2);
  } else {
    // if we don't have left key and we don't have rightkey
    // we return the initial key
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

// contextCallbacks actually is a vector of length l
// callback takes a vector of the same length l
// it is impossible to type this
// it returns a vector of l context that has been changed
// and the result of the callback as well
// to make this function type safe you need dependent types
function nestContexts (
  contextCallbacks: any,
  callback: any,
  contexts: any = []
): any {
  let results;
  if (!contextCallbacks.length) {
    results = [[], callback(contexts.reverse())];
  } else {
    const contextF = contextCallbacks.pop();
    const contextR = contextF(context => {
      contexts.push(context);
      results = nestContexts(contextCallbacks, callback, contexts);
    });
    // $FlowFixMe: results is built dynamically
    results[0].push(contextR);
  }
  // $FlowFixMe: results is built dynamically
  return results;
}

export {
  bindNull,
  leastCommonAncestor,
  interpolationSearch,
  boundIndex,
  nestContexts,
  generateGapKey,
  generateGapKeys
};
