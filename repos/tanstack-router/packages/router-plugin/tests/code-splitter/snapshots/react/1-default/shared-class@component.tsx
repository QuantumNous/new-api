import { store } from "shared-class.tsx?tsr-shared=1";
const SplitComponent = () => <div>{store.get('items')}</div>;
export { SplitComponent as component };