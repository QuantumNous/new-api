import { NavigationMenu } from '@base-ui/react/navigation-menu';
import { createRenderer, describeConformance } from '#test-utils';

describe('<NavigationMenu.Positioner />', () => {
  const { render } = createRenderer();

  describeConformance(<NavigationMenu.Positioner />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(
        <NavigationMenu.Root value="test">
          <NavigationMenu.Portal>{node}</NavigationMenu.Portal>
        </NavigationMenu.Root>,
      );
    },
  }));
});
