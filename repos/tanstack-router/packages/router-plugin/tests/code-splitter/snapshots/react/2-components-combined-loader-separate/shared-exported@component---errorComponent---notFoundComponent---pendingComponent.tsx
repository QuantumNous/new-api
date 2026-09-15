import { queryOptions } from "shared-exported.tsx?tsr-shared=1";
const SplitComponent = () => <div>GC: {queryOptions.gcTime}</div>;
export { SplitComponent as component };