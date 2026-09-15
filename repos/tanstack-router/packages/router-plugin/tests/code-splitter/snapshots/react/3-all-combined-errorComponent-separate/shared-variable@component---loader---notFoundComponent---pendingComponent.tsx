const collection = {
  name: 'todos',
  preload: async () => {}
};
const SplitLoader = async () => {
  await collection.preload();
  return {
    data: 'loaded'
  };
};
export { SplitLoader as loader };
const SplitComponent = () => <div>{collection.name}</div>;
export { SplitComponent as component };