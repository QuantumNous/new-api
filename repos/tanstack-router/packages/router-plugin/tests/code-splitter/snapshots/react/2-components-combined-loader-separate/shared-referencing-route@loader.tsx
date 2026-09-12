import { HEADER } from "shared-referencing-route.tsx?tsr-shared=1";
function usePageTitle() {
  return `${HEADER} - ${Route.fullPath}`;
}
import { Route } from "shared-referencing-route.tsx";
const SplitLoader = async () => {
  const title = usePageTitle();
  return {
    title
  };
};
export { SplitLoader as loader };