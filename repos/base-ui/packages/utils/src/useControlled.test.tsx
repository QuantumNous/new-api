import { expect } from 'vitest';
import * as React from 'react';
import { act, createRenderer } from '@mui/internal-test-utils';
import { useControlled } from './useControlled';

interface TestComponentChildrenArgument {
  value: number | string | object | null;
  setValue: React.Dispatch<React.SetStateAction<number | string>>;
}

interface TestComponentProps {
  value?: number | string;
  defaultValue?: number | string | object | null;
  children: (parames: TestComponentChildrenArgument) => React.ReactNode;
}

function TestComponent({ value: valueProp, defaultValue, children }: TestComponentProps) {
  const [value, setValue] = useControlled({
    controlled: valueProp,
    default: defaultValue,
    name: 'TestComponent',
  });
  return children({ value, setValue });
}

describe('useControlled', () => {
  const { render } = createRenderer();

  it('works correctly when is not controlled', () => {
    let valueState;
    let setValueState: React.Dispatch<React.SetStateAction<number | string>>;
    render(
      <TestComponent defaultValue={1}>
        {({ value, setValue }) => {
          valueState = value;
          setValueState = setValue;
          return null;
        }}
      </TestComponent>,
    );
    expect(valueState).toBe(1);

    act(() => {
      setValueState(2);
    });

    expect(valueState).toBe(2);
  });

  it('works correctly when is controlled', () => {
    let valueState;
    render(
      <TestComponent value={1}>
        {({ value }) => {
          valueState = value;
          return null;
        }}
      </TestComponent>,
    );
    expect(valueState).toBe(1);
  });

  it('warns when switching from uncontrolled to controlled', () => {
    let setProps: (newProps: any) => void;
    expect(() => {
      ({ setProps } = render(<TestComponent>{() => null}</TestComponent>));
    }).not.toErrorDev();

    expect(() => {
      setProps({ value: 'foobar' });
    }).toErrorDev(
      'Base UI: A component is changing the uncontrolled value state of TestComponent to be controlled.',
    );
  });

  it('should warn when switching from controlled to uncontrolled', () => {
    let setProps: (newProps: any) => void;

    expect(() => {
      ({ setProps } = render(<TestComponent value="foobar">{() => null}</TestComponent>));
    }).not.toErrorDev();

    expect(() => {
      setProps({ value: undefined });
    }).toErrorDev(
      'Base UI: A component is changing the controlled value state of TestComponent to be uncontrolled.',
    );
  });

  describe('prop: defaultValue', () => {
    it('warns when changed after initial rendering', () => {
      let setProps: (newProps: any) => void;

      expect(() => {
        ({ setProps } = render(<TestComponent>{() => null}</TestComponent>));
      }).not.toErrorDev();

      expect(() => {
        setProps({ defaultValue: 1 });
      }).toErrorDev(
        'Base UI: A component is changing the default value state of an uncontrolled TestComponent after being initialized.',
      );
    });

    it('does not warn when controlled', () => {
      let setProps: (newProps: any) => void;

      expect(() => {
        ({ setProps } = render(
          <TestComponent value={1} defaultValue={0}>
            {() => null}
          </TestComponent>,
        ));
      }).not.toErrorDev();

      expect(() => {
        setProps({ defaultValue: 1 });
      }).not.toErrorDev();
    });

    it('does not warn when NaN', () => {
      expect(() => {
        render(<TestComponent defaultValue={NaN}>{() => null}</TestComponent>);
      }).not.toErrorDev();
    });

    it('does not warn when an array', () => {
      function TestComponentArray() {
        useControlled({
          controlled: undefined,
          default: [],
          name: 'TestComponent',
        });
        return null;
      }

      expect(() => {
        render(<TestComponentArray />);
      }).not.toErrorDev();
    });

    it('does not throw when defaultValue has React elements', () => {
      function TestComponentArray() {
        useControlled({
          controlled: undefined,
          default: {
            value: <span />,
          },
          name: 'TestComponent',
        });
        return null;
      }

      expect(() => {
        render(<TestComponentArray />);
      }).not.toErrorDev();
    });

    it('does not throw when defaultValue has function', () => {
      const fn = () => 100;

      function TestComponentArray() {
        useControlled({
          controlled: undefined,
          default: {
            value: fn,
          },
          name: 'TestComponent',
        });
        return null;
      }

      expect(() => {
        render(<TestComponentArray />);
      }).not.toErrorDev();
    });

    it('does not throw when defaultValue has bigint', () => {
      function TestComponentBigInt() {
        useControlled({
          controlled: undefined,
          default: 1n,
          name: 'TestComponent',
        });
        return null;
      }

      expect(() => {
        render(<TestComponentBigInt />);
      }).not.toErrorDev();
    });

    it('should warn only when defaultValue changes', () => {
      let setProps: (newProps: any) => void;

      expect(() => {
        ({ setProps } = render(<TestComponent defaultValue={0}>{() => null}</TestComponent>));
      }).not.toErrorDev();

      expect(() => {
        setProps({ defaultValue: 1 });
      }).toErrorDev(
        'Base UI: A component is changing the default value state of an uncontrolled TestComponent after being initialized.',
      );

      expect(() => {
        setProps({ defaultValue: 2 });
      }).not.toErrorDev();

      expect(() => {
        setProps({ defaultValue: 0 });
      }).not.toErrorDev();
    });

    it('should warn only when defaultValue has functions/components and changes', () => {
      let setProps: (newProps: any) => void;

      const items = [
        {
          item: <span />,
        },
        {
          item: () => 100,
        },
        {
          item: <div />,
        },
      ];

      expect(() => {
        ({ setProps } = render(
          <TestComponent defaultValue={items[0]}>{() => null}</TestComponent>,
        ));
      }).not.toErrorDev();

      expect(() => {
        setProps({ defaultValue: items[1] });
      }).toErrorDev(
        'Base UI: A component is changing the default value state of an uncontrolled TestComponent after being initialized.',
      );

      expect(() => {
        setProps({ defaultValue: items[2] });
      }).not.toErrorDev();

      expect(() => {
        setProps({ defaultValue: items[0] });
      }).not.toErrorDev();
    });

    it('should not fail on null values', () => {
      let setProps: (newProps: any) => void;

      const s1 = null;
      const s2 = undefined;

      expect(() => {
        ({ setProps } = render(<TestComponent defaultValue={s1}>{() => null}</TestComponent>));
      }).not.toErrorDev();

      expect(() => {
        setProps({ defaultValue: s2 });
      }).toErrorDev(
        'Base UI: A component is changing the default value state of an uncontrolled TestComponent after being initialized.',
      );

      expect(() => {
        setProps({ defaultValue: s1 });
      }).not.toErrorDev();
    });
  });
});
