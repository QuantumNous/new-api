import * as React from 'react';
import { PreviewCard } from '@base-ui/react/preview-card';
import { createRenderer, describeConformance } from '#test-utils';

describe('<PreviewCard.Portal />', () => {
  const { render } = createRenderer();

  describeConformance(<PreviewCard.Portal keepMounted />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(<PreviewCard.Root open>{node}</PreviewCard.Root>);
    },
  }));
});
