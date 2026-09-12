import type { StageModel } from './stage-model';

export class ModelSet<T extends StageModel = StageModel> {
  modelMap: Record<number, T> = {};
  list: T[] = [];
  listIndexMap: Record<number, number> = {};

  get size() {
    return this.list.length;
  }

  *[Symbol.iterator]() {
    for (const item of this.list) {
      yield item;
    }
  }

  constructor(list?: T[] | ModelSet<T>) {
    list?.forEach((item) => this.add(item));
  }

  getById(id: number) {
    return this.modelMap[id];
  }

  getByIndex(index: number) {
    return this.list[index];
  }

  setByIndex(index: number, value: T) {
    const oldValue = this.list[index];
    if (oldValue) {
      delete this.listIndexMap[oldValue.id];
      delete this.modelMap[oldValue.id];
    }
    this.list[index] = value;
    this.listIndexMap[value.id] = index;
    this.modelMap[value.id] = value;
  }

  findIndexById(id: number) {
    return this.listIndexMap[id] ?? -1;
  }

  findIndex(value: T) {
    return this.findIndexById(value.id);
  }

  add(value: T) {
    if (this.has(value)) {
      return;
    }
    this.modelMap[value.id] = value;
    this.listIndexMap[value.id] = this.list.length;
    this.list.push(value);
  }

  clear() {
    this.modelMap = {};
    this.list = [];
    this.listIndexMap = {};
  }

  delete(value: T): boolean {
    if (!this.has(value)) {
      return false;
    }
    delete this.modelMap[value.id];
    this.list.splice(this.list.indexOf(value), 1);
    const index = this.findIndex(value);
    for (let i = index; i < this.list.length; i++) {
      this.listIndexMap[this.list[i].id] = i;
    }
    delete this.listIndexMap[value.id];
    return true;
  }

  forEach(callbackfn: (value: T, index: number, array: T[]) => void, thisArg?: any) {
    this.list.forEach(callbackfn, thisArg);
  }

  has(value: T) {
    return !!this.modelMap[value.id];
  }

  every(predicate: (value: T, index: number, array: T[]) => unknown, thisArg?: any): boolean {
    return this.list.every(predicate, thisArg);
  }

  some(predicate: (value: T, index: number, array: T[]) => unknown, thisArg?: any): boolean {
    return this.list.some(predicate, thisArg);
  }

  map<U>(callbackfn: (value: T, index: number, array: T[]) => U, thisArg?: any): U[] {
    return this.list.map<U>(callbackfn, thisArg);
  }

  filter(predicate: (value: T, index: number, array: T[]) => unknown, thisArg?: any): T[] {
    return this.list.filter(predicate, thisArg);
  }

  reduce<U>(
    callbackfn: (previousValue: U, currentValue: T, currentIndex: number, array: T[]) => U,
    initialValue: U,
  ): U {
    return this.list.reduce<U>(callbackfn, initialValue);
  }

  releaseAll() {
    this.list.forEach((item) => item.release());
  }
}
