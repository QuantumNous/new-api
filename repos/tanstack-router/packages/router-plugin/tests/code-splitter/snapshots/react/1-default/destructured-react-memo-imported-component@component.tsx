import { memo } from 'react';
function Component() {
  return <div>Component</div>;
}
const SplitComponent = memo(Component);
export { SplitComponent as component };