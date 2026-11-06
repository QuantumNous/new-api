import { Menu } from '@base-ui/react/menu';
import { createRenderer, describeConformance } from '#test-utils';

describe('<Menu.Arrow />', () => {
  const { render } = createRenderer();

  describeConformance(<Menu.Arrow />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>{node}</Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );
    },
  }));
});
