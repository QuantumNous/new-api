import { Meter } from '@base-ui/react/meter';
import { createRenderer, describeConformance } from '#test-utils';

describe('<Meter.Track />', () => {
  const { render } = createRenderer();

  describeConformance(<Meter.Track />, () => ({
    render: (node) => {
      return render(<Meter.Root value={30}>{node}</Meter.Root>);
    },
    refInstanceof: window.HTMLDivElement,
  }));
});
