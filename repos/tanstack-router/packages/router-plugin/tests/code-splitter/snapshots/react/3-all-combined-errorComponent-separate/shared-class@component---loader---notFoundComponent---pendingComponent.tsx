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
const SplitLoader = async () => {
  store.set('items', await fetch('/api'));
};
export { SplitLoader as loader };
const SplitComponent = () => <div>{store.get('items')}</div>;
export { SplitComponent as component };