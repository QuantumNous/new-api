function getComponentName(obj: Record<string, unknown>): string {
  return Object.keys(obj)[0];
}
function App() {
  const componentName = getComponentName({
    App
  });
  return <div>
      Component Name is {componentName}
      <OtherComponent />
    </div>;
}
function OtherComponent() {
  const componentName = getComponentName({
    App
  });
  return <div>App component name is {componentName}</div>;
}
export { App as component };