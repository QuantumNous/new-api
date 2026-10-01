import { queryOptions } from "shared-exported.tsx";
const SplitLoader = async () => {
  return {
    staleTime: queryOptions.staleTime
  };
};
export { SplitLoader as loader };
const SplitComponent = () => <div>GC: {queryOptions.gcTime}</div>;
export { SplitComponent as component };