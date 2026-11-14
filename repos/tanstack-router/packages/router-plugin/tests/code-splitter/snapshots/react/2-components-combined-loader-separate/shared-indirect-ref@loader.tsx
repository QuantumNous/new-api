import { state, getCount } from "shared-indirect-ref.tsx?tsr-shared=1";
const SplitLoader = () => {
  state.count++;
  return {
    count: getCount()
  };
};
export { SplitLoader as loader };