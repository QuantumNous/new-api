import * as React from 'react';
import { Toast } from '@base-ui/react/toast';
import { createRenderer, describeConformance } from '#test-utils';

describe('<Toast.Portal />', () => {
  const { render } = createRenderer();

  describeConformance(<Toast.Portal />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(node);
    },
  }));
});
