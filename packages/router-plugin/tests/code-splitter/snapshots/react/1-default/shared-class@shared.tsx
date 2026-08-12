class DataStore {
  data = new Map();
  get(k: string) {
    return this.data.get(k);
  }
  set(k: string, v: unknown) {
    this.data.set(k, v);
  }
}
const store = new DataStore();
export { DataStore, store };