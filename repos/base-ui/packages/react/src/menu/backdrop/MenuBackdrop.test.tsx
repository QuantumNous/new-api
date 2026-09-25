import { expect } from 'vitest';
import { Menu } from '@base-ui/react/menu';
import { createRenderer, describeConformance } from '#test-utils';
import { screen, waitFor } from '@mui/internal-test-utils';

describe('<Menu.Backdrop />', () => {
  const { render } = createRenderer();

  describeConformance(<Menu.Backdrop />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(<Menu.Root open>{node}</Menu.Root>);
    },
  }));

  it('sets `pointer-events: none` style on backdrop if opened by hover', async () => {
    const { user } = await render(
      <Menu.Root>
        <Menu.Trigger delay={0} openOnHover>
          Open
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Backdrop data-testid="backdrop" />
          <Menu.Positioner>
            <Menu.Popup />
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );

    await user.hover(screen.getByText('Open'));

    expect(screen.getByTestId('backdrop').style.pointerEvents).toBe('none');
  });

  it('does not set `pointer-events: none` style on backdrop if opened by click', async () => {
    const { user } = await render(
      <Menu.Root>
        <Menu.Trigger delay={0}>Open</Menu.Trigger>
        <Menu.Portal>
          <Menu.Backdrop data-testid="backdrop" />
          <Menu.Positioner>
            <Menu.Popup />
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );

    await user.click(screen.getByText('Open'));

    await waitFor(() => {
      expect(screen.getByTestId('backdrop').style.pointerEvents).not.toBe('none');
    });
  });
});
