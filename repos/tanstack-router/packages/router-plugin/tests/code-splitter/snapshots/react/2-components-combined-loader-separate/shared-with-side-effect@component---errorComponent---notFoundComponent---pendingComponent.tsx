import { registry } from "shared-with-side-effect.tsx?tsr-shared=1";
const SplitComponent = () => <div>{registry.size}</div>;
export { SplitComponent as component };