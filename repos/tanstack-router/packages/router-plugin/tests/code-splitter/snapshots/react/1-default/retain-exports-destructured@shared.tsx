const createBits = () => ({
  component: AboutComponentImpl,
  loader: () => ({
    message: 'hello'
  })
});
const {
  component: AboutComponent,
  loader
} = createBits();
function AboutComponentImpl() {
  return <div>About</div>;
}
export { AboutComponent, AboutComponentImpl, createBits, loader };