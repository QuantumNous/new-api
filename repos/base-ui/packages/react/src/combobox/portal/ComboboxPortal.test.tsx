import * as React from 'react';
import { Combobox } from '@base-ui/react/combobox';
import { createRenderer, describeConformance } from '#test-utils';

describe('<Combobox.Portal />', () => {
  const { render } = createRenderer();

  describeConformance(<Combobox.Portal />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(<Combobox.Root open>{node}</Combobox.Root>);
    },
  }));
});
