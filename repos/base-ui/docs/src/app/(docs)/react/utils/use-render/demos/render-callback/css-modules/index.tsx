'use client';
import * as React from 'react';
import { useRender } from '@base-ui/react/use-render';
import { mergeProps } from '@base-ui/react/merge-props';
import styles from './index.module.css';

interface CounterState {
  odd: boolean;
}

interface CounterProps extends useRender.ComponentProps<'button', CounterState> {}

function Counter(props: CounterProps) {
  const { render, ...otherProps } = props;

  const [count, setCount] = React.useState(0);
  const odd = count % 2 === 1;
  const state = React.useMemo(() => ({ odd }), [odd]);

  const defaultProps: useRender.ElementProps<'button'> = {
    className: styles.Button,
    type: 'button',
    children: (
      <React.Fragment>
        Counter: <span className={styles.count}>{count}</span>
      </React.Fragment>
    ),
    onClick() {
      setCount((prev) => prev + 1);
    },
    'aria-label': `Count is ${count}, click to increase.`,
  };

  const element = useRender({
    defaultTagName: 'button',
    render,
    state,
    props: mergeProps<'button'>(defaultProps, otherProps),
  });

  return element;
}

export default function ExampleCounter() {
  return (
    <Counter
      render={(props, state) => (
        <button {...props}>
          {props.children}
          <span className={styles.suffix}>{state.odd ? '👎' : '👍'}</span>
        </button>
      )}
    />
  );
}
