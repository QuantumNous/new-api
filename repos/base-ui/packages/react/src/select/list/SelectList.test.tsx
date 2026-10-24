import { Select } from '@base-ui/react/select';
import { createRenderer, describeConformance } from '#test-utils';

describe('<Select.List />', () => {
  const { render } = createRenderer();

  describeConformance(<Select.List />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(
        <Select.Root open>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>{node}</Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );
    },
  }));
});
