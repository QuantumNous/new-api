import { state, getCount } from "shared-indirect-ref.tsx?tsr-shared=1";
function SharedComponent() {
  return <div>
      {getCount()} - {state.count}
    </div>;
}
export { SharedComponent as component };