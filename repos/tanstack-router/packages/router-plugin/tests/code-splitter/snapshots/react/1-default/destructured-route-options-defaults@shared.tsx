function defaultLoader() {
  return {
    message: 'default'
  };
}
function DefaultComponent() {
  return <div>Default</div>;
}
const createBits = () => ({
  component: ActualComponent,
  loader: () => ({
    message: 'hello'
  })
});
const {
  component: MyComponent = DefaultComponent,
  loader = defaultLoader
} = createBits();
function ActualComponent() {
  return <div>About</div>;
}
export { ActualComponent, createBits, DefaultComponent, defaultLoader, loader, MyComponent };