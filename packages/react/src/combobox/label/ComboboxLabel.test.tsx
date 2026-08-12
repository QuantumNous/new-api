import { Combobox } from '@base-ui/react/combobox';
import { createRenderer, describeConformance } from '#test-utils';

describe('<Combobox.Label />', () => {
  const { render } = createRenderer();

  describeConformance(<Combobox.Label />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(
        <Combobox.Root>
          {node}
          <Combobox.Trigger>Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );
    },
  }));
});
