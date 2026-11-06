import { Select } from '@base-ui/react/select';
import { createRenderer, describeConformance } from '#test-utils';

describe('<Select.ItemText />', () => {
  const { render } = createRenderer();

  describeConformance(<Select.ItemText />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(
        <Select.Root open>
          <Select.Positioner>
            <Select.Item value="">{node}</Select.Item>
          </Select.Positioner>
        </Select.Root>,
      );
    },
  }));
});
