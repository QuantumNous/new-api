import { getCached, cache } from "shared-function.tsx?tsr-shared=1";
function setCached(key: string, val: unknown) {
  cache.set(key, val);
}
const SplitLoader = async () => {
  setCached('data', await fetch('/api').then(r => r.json()));
  return getCached('data');
};
export { SplitLoader as loader };