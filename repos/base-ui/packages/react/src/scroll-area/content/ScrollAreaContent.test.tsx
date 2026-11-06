import { ScrollArea } from '@base-ui/react/scroll-area';
import { createRenderer } from '#test-utils';
import { describeConformance } from '../../../test/describeConformance';

describe('<ScrollArea.Content />', () => {
  const { render } = createRenderer();

  describeConformance(<ScrollArea.Content />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(
        <ScrollArea.Root>
          <ScrollArea.Viewport>{node}</ScrollArea.Viewport>
        </ScrollArea.Root>,
      );
    },
  }));
});
