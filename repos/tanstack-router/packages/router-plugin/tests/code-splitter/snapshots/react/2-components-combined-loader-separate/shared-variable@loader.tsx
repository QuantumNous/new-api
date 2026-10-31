import { collection } from "shared-variable.tsx?tsr-shared=1";
const SplitLoader = async () => {
  await collection.preload();
  return {
    data: 'loaded'
  };
};
export { SplitLoader as loader };