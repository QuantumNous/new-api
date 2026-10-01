import { Meter } from '@base-ui/react/meter';
import { createRenderer, describeConformance } from '#test-utils';

describe('<Meter.Label />', () => {
  const { render } = createRenderer();

  describeConformance(<Meter.Label />, () => ({
    render: (node) => {
      return render(<Meter.Root value={50}>{node}</Meter.Root>);
    },
    refInstanceof: window.HTMLSpanElement,
  }));
});
