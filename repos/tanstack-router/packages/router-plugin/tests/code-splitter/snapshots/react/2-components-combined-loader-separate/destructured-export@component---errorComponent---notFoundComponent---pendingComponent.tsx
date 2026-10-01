export function getObjectCallback() {
  return {
    getObject: () => ({
      constA: 10,
      constB: 5
    })
  };
}
function AboutComponent() {
  return <div className="p-2">
      <h3>About</h3>
    </div>;
}
export { AboutComponent as component };