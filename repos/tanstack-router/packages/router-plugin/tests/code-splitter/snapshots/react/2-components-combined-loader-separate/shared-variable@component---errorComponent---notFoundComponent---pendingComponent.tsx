import { collection } from "shared-variable.tsx?tsr-shared=1";
const SplitComponent = () => <div>{collection.name}</div>;
export { SplitComponent as component };