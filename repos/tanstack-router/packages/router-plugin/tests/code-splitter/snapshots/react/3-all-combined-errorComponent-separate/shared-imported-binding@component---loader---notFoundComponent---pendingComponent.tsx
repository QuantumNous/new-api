import { sharedUtil } from '../utils';
const SplitLoader = async () => sharedUtil('load');
export { SplitLoader as loader };
const SplitComponent = () => <div>{sharedUtil('render')}</div>;
export { SplitComponent as component };