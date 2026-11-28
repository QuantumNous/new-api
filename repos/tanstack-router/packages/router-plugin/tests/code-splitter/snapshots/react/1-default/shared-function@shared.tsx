const cache = new Map();
function getCached(key: string) {
  return cache.get(key);
}
export { cache, getCached };