// @ts-nocheck

const shared = 1;
function SharedComponent() {
  return <div>{shared}</div>;
}
const SplitLoader = () => shared;
export { SplitLoader as loader };
export { SharedComponent as component };