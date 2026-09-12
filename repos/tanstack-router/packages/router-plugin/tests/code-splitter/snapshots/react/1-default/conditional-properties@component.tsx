import { isEnabled } from '@features/feature-flags';
import TrueImport from '@modules/true-component';
import { FalseComponent } from '@modules/false-component';
const SplitComponent = isEnabled ? TrueImport.Component : FalseComponent;
export { SplitComponent as component };