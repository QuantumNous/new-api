const loaderHelper = () => fetch('/api');
const SplitLoader = async () => loaderHelper();
export { SplitLoader as loader };