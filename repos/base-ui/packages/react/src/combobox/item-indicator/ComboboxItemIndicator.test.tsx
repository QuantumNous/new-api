import { Combobox } from '@base-ui/react/combobox';
import { createRenderer, describeConformance } from '#test-utils';

describe('<Combobox.ItemIndicator />', () => {
  const { render } = createRenderer();

  describeConformance(<Combobox.ItemIndicator keepMounted />, () => ({
    refInstanceof: window.HTMLSpanElement,
    render(node) {
      return render(
        <Combobox.Root>
          <Combobox.Item>{node}</Combobox.Item>
        </Combobox.Root>,
      );
    },
  }));
});
