import * as React from 'react';
import { Select } from '@base-ui/react/select';
import { createRenderer, describeConformance } from '#test-utils';

describe('<Select.Portal />', () => {
  const { render } = createRenderer();

  describeConformance(<Select.Portal />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(<Select.Root open>{node}</Select.Root>);
    },
  }));
});
