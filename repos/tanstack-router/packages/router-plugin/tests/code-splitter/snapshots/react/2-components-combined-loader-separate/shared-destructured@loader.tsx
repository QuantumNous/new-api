import { apiUrl } from "shared-destructured.tsx?tsr-shared=1";
const SplitLoader = async () => fetch(apiUrl);
export { SplitLoader as loader };