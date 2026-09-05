const cache = new Map();
function getCached(key: string) {
  return cache.get(key);
}
function setCached(key: string, val: unknown) {
  cache.set(key, val);
}
const SplitLoader = async () => {
  setCached('data', await fetch('/api').then(r => r.json()));
  return getCached('data');
};
export { SplitLoader as loader };
const SplitComponent = () => <div>{JSON.stringify(getCached('data'))}</div>;
export { SplitComponent as component };