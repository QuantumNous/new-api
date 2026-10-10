import { Select } from '@base-ui/react/select';
import { createRenderer, describeConformance } from '#test-utils';

describe('<Select.ItemIndicator />', () => {
  const { render } = createRenderer();

  describeConformance(<Select.ItemIndicator />, () => ({
    refInstanceof: window.HTMLSpanElement,
    render(node) {
      return render(
        <Select.Root open>
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Positioner>
            <Select.Item>{node}</Select.Item>
          </Select.Positioner>
        </Select.Root>,
      );
    },
  }));
});
