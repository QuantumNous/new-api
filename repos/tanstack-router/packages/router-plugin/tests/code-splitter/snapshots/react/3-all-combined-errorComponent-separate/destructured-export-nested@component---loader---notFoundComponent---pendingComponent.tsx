import { baseUrl } from "destructured-export-nested.tsx";
function AboutComponent() {
  return <div>
      <p>Base URL: {baseUrl}</p>
    </div>;
}
export { AboutComponent as component };