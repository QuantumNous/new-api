import { NavigationMenu } from '@base-ui/react/navigation-menu';
import { createRenderer, describeConformance } from '#test-utils';

describe('<NavigationMenu.Item />', () => {
  const { render } = createRenderer();

  describeConformance(<NavigationMenu.Item />, () => ({
    refInstanceof: window.HTMLLIElement,
    render(node) {
      return render(<NavigationMenu.Root>{node}</NavigationMenu.Root>);
    },
  }));
});
