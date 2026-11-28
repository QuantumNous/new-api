import { getCached } from "shared-function.tsx?tsr-shared=1";
const SplitComponent = () => <div>{JSON.stringify(getCached('data'))}</div>;
export { SplitComponent as component };