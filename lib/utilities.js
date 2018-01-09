// @flow

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
    let probeKey = Math.trunc(keyLow + valuePosition * spaceMappingRatio);
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

// the js splice function already does bounding
// however it does it slightly strangely
//             [1,  2,  3]
// has indexes
// positive:  0,  1,  2,  3
// negative: -3, -2, -1
// whereas we want
// positive:  0,  1,  2,  3
// negative: -4, -3, -2, -1
// with shift = true
// we use this boundIndex to achieve the correct splicing operation we want
// so position is a representation of the in-between index
// i think my way makes more sense and is more useful position index
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
