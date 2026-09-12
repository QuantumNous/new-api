import { Slider } from '@base-ui/react/slider';
import { createRenderer, describeConformance } from '#test-utils';

describe('<Slider.Indicator />', () => {
  const { render } = createRenderer();

  describeConformance(<Slider.Indicator />, () => ({
    render: (node) => {
      return render(<Slider.Root>{node}</Slider.Root>);
    },
    refInstanceof: window.HTMLDivElement,
  }));
});
