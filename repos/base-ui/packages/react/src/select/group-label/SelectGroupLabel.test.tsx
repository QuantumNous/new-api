import { Select } from '@base-ui/react/select';
import { createRenderer, describeConformance } from '#test-utils';

describe('<Select.GroupLabel />', () => {
  const { render } = createRenderer();

  describeConformance(<Select.GroupLabel />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(
        <Select.Root open>
          <Select.Group>{node}</Select.Group>
        </Select.Root>,
      );
    },
  }));
});
