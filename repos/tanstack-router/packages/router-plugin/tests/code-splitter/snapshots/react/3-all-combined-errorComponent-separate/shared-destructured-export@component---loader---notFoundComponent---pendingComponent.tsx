import { apiUrl, timeout } from "shared-destructured-export.tsx";
const SplitLoader = async () => fetch(apiUrl);
export { SplitLoader as loader };
const SplitComponent = () => <div>Timeout: {timeout}</div>;
export { SplitComponent as component };