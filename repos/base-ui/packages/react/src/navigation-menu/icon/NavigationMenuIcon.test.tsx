import { NavigationMenu } from '@base-ui/react/navigation-menu';
import { createRenderer, describeConformance } from '#test-utils';

describe('<NavigationMenu.Icon />', () => {
  const { render } = createRenderer();

  describeConformance(<NavigationMenu.Icon />, () => ({
    refInstanceof: window.HTMLSpanElement,
    render(node) {
      return render(
        <NavigationMenu.Root>
          <NavigationMenu.Item>{node}</NavigationMenu.Item>
        </NavigationMenu.Root>,
      );
    },
  }));
});
