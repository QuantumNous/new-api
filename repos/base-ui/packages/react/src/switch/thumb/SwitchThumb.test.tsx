import { Switch } from '@base-ui/react/switch';
import { createRenderer, describeConformance } from '#test-utils';
import { SwitchRootContext } from '../root/SwitchRootContext';

const testContext: SwitchRootContext = {
  checked: false,
  disabled: false,
  readOnly: false,
  required: false,
  dirty: false,
  touched: false,
  filled: false,
  focused: false,
  valid: null,
};

describe('<Switch.Thumb />', () => {
  const { render } = createRenderer();

  describeConformance(<Switch.Thumb />, () => ({
    refInstanceof: window.HTMLSpanElement,
    render: (node) => {
      return render(
        <SwitchRootContext.Provider value={testContext}>{node}</SwitchRootContext.Provider>,
      );
    },
  }));
});
