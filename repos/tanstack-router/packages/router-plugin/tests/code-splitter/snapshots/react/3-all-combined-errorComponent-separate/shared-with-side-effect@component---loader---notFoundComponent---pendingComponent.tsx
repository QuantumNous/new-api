const registry = new Map();
const SplitLoader = async () => {
  registry.set('loaded', true);
};
export { SplitLoader as loader };
const SplitComponent = () => <div>{registry.size}</div>;
export { SplitComponent as component };