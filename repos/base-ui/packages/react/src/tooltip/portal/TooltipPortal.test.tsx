import * as React from 'react';
import { Tooltip } from '@base-ui/react/tooltip';
import { createRenderer, describeConformance } from '#test-utils';

describe('<Tooltip.Portal />', () => {
  const { render } = createRenderer();

  describeConformance(<Tooltip.Portal />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(<Tooltip.Root open>{node}</Tooltip.Root>);
    },
  }));
});
