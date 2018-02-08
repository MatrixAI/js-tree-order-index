
class GapLink<b> {
  block: b;
  key: number;
  constructor (block: b, key: number) {
    this.block = block;
    this.key = key;
    Object.freeze(this);
  }
}

export default GapLink;
