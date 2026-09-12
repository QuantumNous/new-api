import { baseUrl, timeout } from "destructured-export-multiple.tsx";
function AboutComponent() {
  return <div>
      <p>Base URL: {baseUrl}</p>
      <p>Timeout: {timeout}</p>
    </div>;
}
export { AboutComponent as component };