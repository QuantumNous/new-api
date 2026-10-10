import { expect } from 'vitest';
import { Drawer } from '@base-ui/react/drawer';
import { screen } from '@mui/internal-test-utils';
import { createRenderer } from '#test-utils';

interface TestCaseProps {
  open: boolean;
}

function TestCase(props: TestCaseProps) {
  const { open } = props;

  return (
    <Drawer.Provider>
      <Drawer.IndentBackground data-testid="bg" />
      <Drawer.Root open={open}>
        <Drawer.Trigger>Open</Drawer.Trigger>
      </Drawer.Root>
    </Drawer.Provider>
  );
}

describe('<Drawer.IndentBackground />', () => {
  const { render } = createRenderer();

  it('sets data-active when any drawer is open', async () => {
    const { setProps } = await render(<TestCase open={false} />);

    const background = screen.getByTestId('bg');

    expect(background.getAttribute('data-inactive')).toBe('');
    expect(background.getAttribute('data-active')).toBeNull();

    await setProps({ open: true });

    expect(background.getAttribute('data-active')).toBe('');
    expect(background.getAttribute('data-inactive')).toBeNull();
  });
});
