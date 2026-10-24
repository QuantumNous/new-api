import React from 'react';
function Component() {
  return <div>Component</div>;
}
const SplitComponent = React.memo(Component);
export { SplitComponent as component };