// Test errorComponent with false literal
const SplitLoader = async () => ({
  data: 'test'
});
export { SplitLoader as loader };
const SplitComponent = () => <div>Test Component</div>;
export { SplitComponent as component };