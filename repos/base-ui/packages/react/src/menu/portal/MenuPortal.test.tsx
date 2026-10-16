import * as React from 'react';
import { Menu } from '@base-ui/react/menu';
import { createRenderer, describeConformance } from '#test-utils';

describe('<Menu.Portal />', () => {
  const { render } = createRenderer();

  describeConformance(<Menu.Portal keepMounted />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(<Menu.Root>{node}</Menu.Root>);
    },
  }));
});
