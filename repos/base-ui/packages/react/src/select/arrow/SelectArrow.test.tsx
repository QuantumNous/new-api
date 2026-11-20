import { Select } from '@base-ui/react/select';
import { createRenderer, describeConformance } from '#test-utils';

describe('<Select.Arrow />', () => {
  const { render } = createRenderer();

  describeConformance(<Select.Arrow />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(
        <Select.Root open>
          <Select.Positioner alignItemWithTrigger={false}>{node}</Select.Positioner>
        </Select.Root>,
      );
    },
  }));
});
