const state = {
  count: 0
};
function getCount() {
  return state.count;
}
function SharedComponent() {
  return <div>
      {getCount()} - {state.count}
    </div>;
}
const SplitLoader = () => {
  state.count++;
  return {
    count: getCount()
  };
};
export { SplitLoader as loader };
export { SharedComponent as component };