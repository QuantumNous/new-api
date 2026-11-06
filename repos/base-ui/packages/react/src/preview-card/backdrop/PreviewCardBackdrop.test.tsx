import { expect } from 'vitest';
import { PreviewCard } from '@base-ui/react/preview-card';
import { screen, waitFor } from '@mui/internal-test-utils';
import { createRenderer, describeConformance } from '#test-utils';

describe('<PreviewCard.Backdrop />', () => {
  const { render } = createRenderer();

  describeConformance(<PreviewCard.Backdrop />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(<PreviewCard.Root open>{node}</PreviewCard.Root>);
    },
  }));

  it('sets `pointer-events: none` style', async () => {
    const { user } = await render(
      <PreviewCard.Root>
        <PreviewCard.Trigger delay={0} closeDelay={0}>
          Open
        </PreviewCard.Trigger>
        <PreviewCard.Portal>
          <PreviewCard.Backdrop data-testid="backdrop" />
          <PreviewCard.Positioner>
            <PreviewCard.Popup />
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </PreviewCard.Root>,
    );

    await user.hover(screen.getByText('Open'));

    await waitFor(() => {
      expect(screen.getByTestId('backdrop').style.pointerEvents).toBe('none');
    });
  });
});
