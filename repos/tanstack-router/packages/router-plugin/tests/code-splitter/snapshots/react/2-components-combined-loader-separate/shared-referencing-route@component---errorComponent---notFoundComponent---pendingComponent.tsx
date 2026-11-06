import { HEADER } from "shared-referencing-route.tsx?tsr-shared=1";
function usePageTitle() {
  return `${HEADER} - ${Route.fullPath}`;
}
import { Route } from "shared-referencing-route.tsx";
const SplitComponent = () => {
  const title = usePageTitle();
  return <div>{title}</div>;
};
export { SplitComponent as component };