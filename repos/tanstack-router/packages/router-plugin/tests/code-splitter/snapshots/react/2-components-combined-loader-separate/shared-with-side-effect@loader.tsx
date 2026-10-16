import { registry } from "shared-with-side-effect.tsx?tsr-shared=1";
const SplitLoader = async () => {
  registry.set('loaded', true);
};
export { SplitLoader as loader };