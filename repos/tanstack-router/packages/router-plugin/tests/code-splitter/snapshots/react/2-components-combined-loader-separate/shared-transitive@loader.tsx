import { config } from "shared-transitive.tsx?tsr-shared=1";
const fetcher = (path: string) => fetch(`${config.url}${path}`);
const SplitLoader = async () => {
  return fetcher('/data');
};
export { SplitLoader as loader };