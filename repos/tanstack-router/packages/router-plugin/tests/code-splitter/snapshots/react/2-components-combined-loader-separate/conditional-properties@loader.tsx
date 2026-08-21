import { isEnabled } from '@features/feature-flags';
import TrueImport from '@modules/true-component';
import { falseLoader } from '@modules/false-component';
const SplitLoader = isEnabled ? TrueImport.loader : falseLoader;
export { SplitLoader as loader };