'use client';
import * as React from 'react';
import clsx from 'clsx';
import { Dialog } from '@base-ui/react/dialog';
import { useTransitionStatus } from '@base-ui/react/internals/useTransitionStatus';
import { animated as springAnimated, useSpring, useSpringRef } from '@react-spring/web';
import { SettingsMetadata, useExperimentSettings } from '../_components/SettingsPanel';
import classes from './nested.module.css';

const NESTED_DIALOGS = 8;

interface Settings {
  keepMounted: boolean;
  modal: boolean;
  disablePointerDismissal: boolean;
}

function renderContent(
  title: string,
  includeNested: number,
  nestedClassName: string,
  modal: boolean,
  disablePointerDismissal: boolean,
) {
  return (
    <React.Fragment>
      <Dialog.Title className={classes.title}>{title}</Dialog.Title>
      <Dialog.Description>This is a sample dialog.</Dialog.Description>
      <p>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam eget sapien id dolor rutrum
        porta. Sed enim nulla, placerat eu tincidunt non, ultrices in lectus. Curabitur pellentesque
        diam nec ligula hendrerit dapibus.
      </p>

      <div className={classes.form}>
        <textarea placeholder="Testing focus" />
        <input type="text" placeholder="Testing focus" />
        <input type="text" placeholder="Testing focus" />
      </div>

      <div className={classes.controls}>
        {includeNested > 0 ? (
          <Dialog.Root modal={modal} disablePointerDismissal={disablePointerDismissal}>
            <Dialog.Trigger className={classes.button}>Open nested</Dialog.Trigger>
            <Dialog.Backdrop className={clsx(classes.backdrop, nestedClassName)} />
            <Dialog.Portal>
              <Dialog.Popup className={clsx(classes.dialog, nestedClassName)}>
                {renderContent(
                  `Nested dialog ${NESTED_DIALOGS + 1 - includeNested}`,
                  includeNested - 1,
                  nestedClassName,
                  modal,
                  disablePointerDismissal,
                )}
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        ) : null}

        <Dialog.Close className={classes.button}>Close</Dialog.Close>
      </div>
    </React.Fragment>
  );
}

function CssTransitionDialogDemo({ keepMounted, modal, disablePointerDismissal }: Settings) {
  return (
    <span className={classes.demo}>
      <Dialog.Root modal={modal} disablePointerDismissal={disablePointerDismissal}>
        <Dialog.Trigger className={classes.button}>Open with CSS transition</Dialog.Trigger>

        <Dialog.Portal keepMounted={keepMounted}>
          <Dialog.Backdrop className={clsx(classes.backdrop, classes.withTransitions)} />
          <Dialog.Popup className={clsx(classes.dialog, classes.withTransitions)}>
            {renderContent(
              'Dialog with CSS transitions',
              NESTED_DIALOGS,
              classes.withTransitions,
              modal,
              disablePointerDismissal,
            )}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </span>
  );
}

function CssAnimationDialogDemo({ keepMounted, modal, disablePointerDismissal }: Settings) {
  return (
    <span className={classes.demo}>
      <Dialog.Root modal={modal} disablePointerDismissal={disablePointerDismissal}>
        <Dialog.Trigger className={classes.button}>Open with CSS animation</Dialog.Trigger>

        <Dialog.Portal keepMounted={keepMounted}>
          <Dialog.Backdrop className={clsx(classes.backdrop, classes.withAnimations)} />
          <Dialog.Popup className={clsx(classes.dialog, classes.withAnimations)}>
            {renderContent(
              'Dialog with CSS animations',
              NESTED_DIALOGS,
              classes.withAnimations,
              modal,
              disablePointerDismissal,
            )}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </span>
  );
}

// @ts-expect-error To be used later
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ReactSpringDialogDemo({ keepMounted, modal, disablePointerDismissal }: DemoProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <span className={classes.demo}>
      <Dialog.Root disablePointerDismissal open={open} onOpenChange={setOpen}>
        <Dialog.Trigger className={classes.button}>
          Open with React Spring transition
        </Dialog.Trigger>

        <Dialog.Backdrop className={`${classes.backdrop} ${classes.withAnimations}`} />

        <ReactSpringTransition open={open}>
          <Dialog.Portal keepMounted={keepMounted}>
            <Dialog.Popup className={`${classes.dialog} ${classes.withReactSpringTransition}`}>
              {renderContent(
                'Dialog with ReactSpring transitions',
                3,
                classes.withReactSpringTransition,
                modal,
                disablePointerDismissal,
              )}
            </Dialog.Popup>
          </Dialog.Portal>
        </ReactSpringTransition>
      </Dialog.Root>
    </span>
  );
}

function ReactSpringTransition(props: { open: boolean; children?: React.ReactElement<unknown> }) {
  const { open, children } = props;

  const api = useSpringRef();
  const springs = useSpring({
    ref: api,
    from: { opacity: 0, transform: 'translateY(-8px) scale(0.95)' },
  });

  const { mounted, setMounted } = useTransitionStatus(open);

  React.useEffect(() => {
    if (open) {
      api.start({
        opacity: 1,
        transform: 'translateY(0) scale(1)',
        config: { tension: 250, friction: 10 },
      });
    } else {
      api.start({
        opacity: 0,
        transform: 'translateY(-8px) scale(0.95)',
        config: { tension: 170, friction: 26 },
        onRest: () => setMounted(false),
      });
    }
  }, [api, open, mounted, setMounted]);

  return mounted ? (
    <springAnimated.div style={springs} className={classes.springWrapper}>
      {children}
    </springAnimated.div>
  ) : null;
}

export default function DialogExperiment() {
  const { settings } = useExperimentSettings<Settings>();

  return (
    <div className={classes.page}>
      <h1>Nested dialogs</h1>
      <CssTransitionDialogDemo
        keepMounted={settings.keepMounted}
        modal={settings.modal}
        disablePointerDismissal={settings.disablePointerDismissal}
      />
      <CssAnimationDialogDemo
        keepMounted={settings.keepMounted}
        modal={settings.modal}
        disablePointerDismissal={settings.disablePointerDismissal}
      />
    </div>
  );
}

export const settingsMetadata: SettingsMetadata<Settings> = {
  modal: {
    type: 'boolean',
    label: 'Modal',
    default: true,
  },
  disablePointerDismissal: {
    type: 'boolean',
    label: 'Disable pointer Dismissal',
    default: true,
  },
  keepMounted: {
    type: 'boolean',
    label: 'Keep mounted',
    default: false,
  },
};
