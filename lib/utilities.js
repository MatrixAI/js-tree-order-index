// @flow

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

export { interpolationSearch, boundIndex };
