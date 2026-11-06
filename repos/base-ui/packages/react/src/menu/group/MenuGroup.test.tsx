import { expect } from 'vitest';
import { screen } from '@mui/internal-test-utils';
import { Menu } from '@base-ui/react/menu';
import { createRenderer, describeConformance } from '#test-utils';

describe('<Menu.Group />', () => {
  const { render } = createRenderer();

  describeConformance(<Menu.Group />, () => ({
    render,
    refInstanceof: window.HTMLDivElement,
  }));

  it('renders a div with the `group` role', async () => {
    await render(<Menu.Group />);
    expect(screen.getByRole('group')).toBeVisible();
  });
});
