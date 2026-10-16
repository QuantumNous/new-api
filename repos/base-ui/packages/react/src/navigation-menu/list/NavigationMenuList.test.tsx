import { NavigationMenu } from '@base-ui/react/navigation-menu';
import { createRenderer, describeConformance } from '#test-utils';

describe('<NavigationMenu.List />', () => {
  const { render } = createRenderer();

  describeConformance(<NavigationMenu.List />, () => ({
    refInstanceof: window.HTMLUListElement,
    render(node) {
      return render(<NavigationMenu.Root>{node}</NavigationMenu.Root>);
    },
  }));
});
