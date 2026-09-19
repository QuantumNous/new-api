import { config } from "shared-transitive.tsx?tsr-shared=1";
const SplitComponent = () => <div>Timeout: {config.timeout}</div>;
export { SplitComponent as component };