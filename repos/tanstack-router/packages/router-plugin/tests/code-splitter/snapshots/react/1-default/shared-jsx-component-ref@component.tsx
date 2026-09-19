import { shared } from "shared-jsx-component-ref.tsx?tsr-shared=1"; // @ts-nocheck
function SharedComponent() {
  return <div>{shared}</div>;
}
export { SharedComponent as component };