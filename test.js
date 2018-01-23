// @flow

class ArrayFixed<child> {

  _array: Array<child>;
  _count: number;
  _indexFirst: ?number;
  _indexLast: ?number;

  constructor (size: number) {
    this._array = new Array(size);
    this._count = 0;
    this._indexFirst = null;
    this._indexLast = null;
  }

  static fromArray (arrayNew: Array<child>) {
    let count = 0;
    let indexLast;
    arrayNew.forEach((value, index) => {
      if (count === 0) this._indexFirst = index;
      indexLast = index;
      ++count;
    });
    this._array = arrayNew;
    this._count = count;
    this._indexLast = (indexLast) ? indexLast : null;
  }

  get count (): number {
    return this._count;
  }

  toArray (): Array<child> {
    return [...this._array];
  }

  get (index: number): ?child {
    if (index >= this._array.length || index < 0) {
      throw new RangeError();
    }
    return this._array[index];
  }

  set (index: number, value: child): void {
    if (index >= this._array.length || index < 0) {
      throw new RangeError();
    }
    if (!this._array.hasOwnProperty(index)) {
      this._array[index] = value;
      ++this._count;
    } else {
      this._array[index] = value;
    }
    if (this._indexFirst == null || index < this._indexFirst) {
      this._indexFirst = index;
    }
    if (this._indexLast == null || index > this._indexLast) {
      this._indexLast = index;
    }
    return;
  }

  delete (index: number): boolean {
    if (index >= this._array.length || index < 0) {
      throw new RangeError();
    }
    if (this._array.hasOwnProperty(index)) {
      delete this._array[index];
      --this._count;
      if (this._count === 0) {
        this._indexFirst = null;
        this._indexLast = null;
      } else if (this._count === 1) {
        // short circuiting find of the first defined element
        this._array.some((value, index) => {
          this._indexFirst = index;
          this._indexLast = index;
          return true;
        });
      } else {
        if (index === this._indexFirst) {
          this._array.some((value, index) => {
            this._indexFirst = index;
            return true;
          });
        } else if (index === this._indexLast) {
          for (let i = this._array.length - 1; i >= 0; --i) {
            if (this._array.hasOwnProperty(i)) {
              this._indexLast = i;
              break;
            }
          }
        }
      }
      return true;
    } else {
      return false;
    }
  }

  collapseLeft () {
    const arrayNew = new Array(this._array.length);
    let counter = 0;
    for (let index in this._array) {
      arrayNew[counter] = this._array[index];
      ++counter;
    }
    this._array = arrayNew;
    if (this._count > 0) {
      this._indexFirst = 0;
      this._indexLast = this._count - 1;
    }
  }

  collapseRight () {
    const arrayNew = new Array(this._array.length);
    let counter = this._array.length - 1;
    for (let index in this._array) {
      arrayNew[counter] = this._array[index];
      --counter;
    }
    this._array = arrayNew;
    if (this._count > 0) {
      this._indexFirst = this._array.length - this.count;
      this._indexLast = this._array.length - 1;
    }
  }

  [Symbol.iterator] (): Iterator<child> {
    return this._array.values();
  }

}

let arr = new ArrayFixed(10);

arr.set(1, 1);
arr.delete(1);
console.log(arr);
