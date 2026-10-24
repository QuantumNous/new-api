import * as React from 'react';
import { NavigationMenu } from '@base-ui/react/navigation-menu';
import { createRenderer, describeConformance } from '#test-utils';

describe('<NavigationMenu.Portal />', () => {
  const { render } = createRenderer();

  describeConformance(<NavigationMenu.Portal />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(<NavigationMenu.Root value="item">{node}</NavigationMenu.Root>);
    },
  }));
});
