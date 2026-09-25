import { queryOptions } from "shared-exported.tsx?tsr-shared=1";
const SplitLoader = async () => {
  return {
    staleTime: queryOptions.staleTime
  };
};
export { SplitLoader as loader };