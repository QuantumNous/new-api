import { Slider } from '@base-ui/react/slider';
import { createRenderer, describeConformance } from '#test-utils';

describe('<Slider.Label />', () => {
  const { render } = createRenderer();

  describeConformance(<Slider.Label />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(
        <Slider.Root defaultValue={50}>
          {node}
          <Slider.Control>
            <Slider.Thumb />
          </Slider.Control>
        </Slider.Root>,
      );
    },
  }));
});
