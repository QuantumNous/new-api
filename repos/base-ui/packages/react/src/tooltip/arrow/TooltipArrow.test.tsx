import { Tooltip } from '@base-ui/react/tooltip';
import { createRenderer, describeConformance } from '#test-utils';

describe('<Tooltip.Arrow />', () => {
  const { render } = createRenderer();

  describeConformance(<Tooltip.Arrow />, () => ({
    refInstanceof: window.Element,
    render(node) {
      return render(
        <Tooltip.Root open>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup>{node}</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>,
      );
    },
  }));
});
