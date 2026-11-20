import { store } from "shared-class.tsx?tsr-shared=1";
const SplitLoader = async () => {
  store.set('items', await fetch('/api'));
};
export { SplitLoader as loader };