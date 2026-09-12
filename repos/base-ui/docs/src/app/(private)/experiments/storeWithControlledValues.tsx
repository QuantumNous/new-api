'use client';
import * as React from 'react';
import { useRefWithInit } from '@base-ui/utils/useRefWithInit';
import { ReactStore } from '@base-ui/utils/store';
import { useStableCallback } from '@base-ui/utils/useStableCallback';
import styles from './storeWithControlledValues.module.css';

export default function Playground() {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState(0);

  return (
    <div className={styles.Container}>
      <h2 className={styles.Heading}>Controlled mode</h2>
      <div className={styles.Row}>
        <button type="button" className={styles.Button} onClick={() => setOpen((o) => !o)}>
          Toggle externally
        </button>
        <ControllableComponent
          open={open}
          onOpenChange={(nextOpen, reason) => {
            setOpen(nextOpen);
            console.log('reason', reason);
          }}
          value={value}
        />
      </div>

      <h2 className={styles.Heading}>Uncontrolled mode (open by default)</h2>
      <div className={styles.Row}>
        <ControllableComponent
          defaultOpen={true}
          onOpenChange={(_, reason) => {
            console.log('reason', reason);
          }}
          value={value}
        />
      </div>

      <h2 className={styles.Heading}>Uncontrolled mode (closed by default)</h2>
      <div className={styles.Row}>
        <ControllableComponent
          defaultOpen={false}
          onOpenChange={(_, reason) => {
            console.log('reason', reason);
          }}
          value={value}
        />
      </div>

      <h2>Value updater</h2>
      <div className={styles.Row}>
        <input
          type="number"
          value={value}
          onChange={(event) => setValue(event.target.valueAsNumber)}
        />
      </div>
    </div>
  );
}

interface Props {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, reason: string) => void;
  value?: number;
}

function ControllableComponent(props: Props) {
  const store = useRefWithInit(
    () =>
      new ReactStore(
        {
          open: props.defaultOpen ?? false,
          openProp: props.open,
          value: 0,
        },
        {},
        selectors,
      ),
  ).current;

  store.useControlledProp('openProp', props.open);
  store.useSyncedValue('value', props.value ?? 0);

  const open = store.useState('open');
  const value = store.useState('value');

  const handleClick = useStableCallback(() => {
    store.set('open', !open);
    props.onOpenChange?.(!open, 'toggle-button');
  });

  return (
    <React.Fragment>
      <span>open: {open?.toString() ?? 'undefined'}</span>
      <ChildComponent store={store} />
      <button type="button" className={styles.Button} onClick={handleClick}>
        Toggle internally
      </button>
      <span>value: {value}</span>
    </React.Fragment>
  );
}

interface ChildProps {
  store: ReactStore<State, {}, typeof selectors>;
}

function ChildComponent(props: ChildProps) {
  const open = props.store.useState('open');
  return <span>child sees open: {open.toString()}</span>;
}

interface State {
  open: boolean;
  openProp: boolean | undefined;
  value: number;
}

const selectors = {
  open: (state: State) => state.openProp ?? state.open,
  value: (state: State) => state.value,
};
