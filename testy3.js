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

console.log(boundIndex(-1, 3));
