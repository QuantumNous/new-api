'use client';
import * as React from 'react';
import clsx from 'clsx';
import { Dialog } from '@base-ui/react/dialog';
import demoStyles from 'docs/src/app/(docs)/react/components/dialog/demos/hero/css-modules/index.module.css';
import { SettingsMetadata, useExperimentSettings } from '../_components/SettingsPanel';
import styles from './dialog.module.css';

interface Settings {
  modal: boolean;
  disablePointerDismissal: boolean;
  keepMounted: boolean;
  renderBackdrop?: boolean;
}

const dialogContents = {
  Profile: (
    <React.Fragment>
      <p>Manage profile information and preferences from a focused workspace.</p>
      <p>Changes apply immediately once you save them, so review carefully before closing.</p>
    </React.Fragment>
  ),
  Invites: (
    <React.Fragment>
      <p>Invite teammates to access the latest project artifacts and timelines.</p>
      <p>Decide who can edit, comment, or just follow progress from the audience controls.</p>
    </React.Fragment>
  ),
  Tasks: <p>Review the highest priority tasks assigned to you this week and adjust due dates.</p>,
  Notifications: (
    <React.Fragment>
      <p>Fine tune which notifications should reach your inbox versus stay muted.</p>
      <p>Turn off sources that create noise while keeping critical alerts ready.</p>
    </React.Fragment>
  ),
};

const triggerLabels = Object.keys(dialogContents) as (keyof typeof dialogContents)[];

const detachedDialog = Dialog.createHandle<keyof typeof dialogContents>();
const controlledDetachedDialog = Dialog.createHandle<keyof typeof dialogContents>();
const handleControlledDialog = Dialog.createHandle<keyof typeof dialogContents>();

export default function DialogExperiment() {
  const { settings } = useExperimentSettings<Settings>();

  const [singleTriggerOpen, setSingleTriggerOpen] = React.useState(false);

  const [controlledWithinRootOpen, setControlledWithinRootOpen] = React.useState(false);
  const [controlledWithinRootTriggerId, setControlledWithinRootTriggerId] = React.useState<
    string | null
  >(null);

  const [controlledDetachedOpen, setControlledDetachedOpen] = React.useState(false);
  const [controlledDetachedTriggerId, setControlledDetachedTriggerId] = React.useState<
    string | null
  >(null);

  return (
    <div className={styles.Page}>
      <h1>Dialogs</h1>

      <h2>Uncontrolled, single trigger</h2>
      <div className={styles.Container}>
        <Dialog.Root
          modal={settings.modal}
          disablePointerDismissal={settings.disablePointerDismissal}
        >
          <StyledTrigger>Invites</StyledTrigger>
          {renderDialogContent('Invites', settings)}
        </Dialog.Root>
      </div>

      <h2>Controlled, single trigger</h2>
      <div className={styles.Container}>
        <Dialog.Root
          modal={settings.modal}
          disablePointerDismissal={settings.disablePointerDismissal}
          open={singleTriggerOpen}
          onOpenChange={(nextOpen) => setSingleTriggerOpen(nextOpen)}
        >
          <StyledTrigger>Profile</StyledTrigger>
          {renderDialogContent('Profile', settings)}
        </Dialog.Root>
        <button
          type="button"
          className={clsx(demoStyles.Button, styles.Button)}
          onClick={() => setSingleTriggerOpen(true)}
        >
          Open programmatically
        </button>
      </div>

      <h2>Uncontrolled, multiple triggers within Root</h2>
      <div className={styles.Container}>
        <Dialog.Root
          modal={settings.modal}
          disablePointerDismissal={settings.disablePointerDismissal}
        >
          {({ payload }) => (
            <React.Fragment>
              <StyledTrigger payload={triggerLabels[0]}>{triggerLabels[0]}</StyledTrigger>
              <StyledTrigger payload={triggerLabels[1]}>{triggerLabels[1]}</StyledTrigger>
              <StyledTrigger payload={triggerLabels[2]}>{triggerLabels[2]}</StyledTrigger>
              {renderDialogContent(payload as keyof typeof dialogContents, settings)}
            </React.Fragment>
          )}
        </Dialog.Root>
      </div>

      <h2>Controlled, multiple triggers within Root</h2>
      <div className={styles.Container}>
        <Dialog.Root
          modal={settings.modal}
          disablePointerDismissal={settings.disablePointerDismissal}
          open={controlledWithinRootOpen}
          onOpenChange={(nextOpen, eventDetails) => {
            setControlledWithinRootOpen(nextOpen);
            setControlledWithinRootTriggerId(eventDetails.trigger?.id ?? null);
          }}
          triggerId={controlledWithinRootTriggerId}
        >
          {({ payload }) => (
            <React.Fragment>
              <StyledTrigger payload={triggerLabels[0]}>{triggerLabels[0]}</StyledTrigger>
              <StyledTrigger payload={triggerLabels[1]} id="within-root-second-trigger">
                {triggerLabels[1]}
              </StyledTrigger>
              <StyledTrigger payload={triggerLabels[2]}>{triggerLabels[2]}</StyledTrigger>
              {renderDialogContent(payload as keyof typeof dialogContents, settings)}
            </React.Fragment>
          )}
        </Dialog.Root>
        <button
          type="button"
          className={clsx(demoStyles.Button, styles.Button)}
          onClick={() => {
            setControlledWithinRootOpen(true);
            setControlledWithinRootTriggerId('within-root-second-trigger');
          }}
        >
          Open programmatically (Invites)
        </button>
      </div>

      <h2>Uncontrolled, detached triggers</h2>
      <div className={styles.Container}>
        <StyledDialog handle={detachedDialog} />
        <StyledTrigger handle={detachedDialog} payload={triggerLabels[0]}>
          {triggerLabels[0]}
        </StyledTrigger>
        <StyledTrigger handle={detachedDialog} payload={triggerLabels[1]}>
          {triggerLabels[1]}
        </StyledTrigger>
        <StyledTrigger handle={detachedDialog} payload={triggerLabels[2]}>
          {triggerLabels[2]}
        </StyledTrigger>
        <StyledTrigger handle={detachedDialog} payload={triggerLabels[3]}>
          {triggerLabels[3]}
        </StyledTrigger>
      </div>

      <h2>Controlled, detached triggers</h2>
      <div className={styles.Container}>
        <StyledDialog
          handle={controlledDetachedDialog}
          open={controlledDetachedOpen}
          triggerId={controlledDetachedTriggerId}
          onOpenChange={(nextOpen, eventDetails) => {
            setControlledDetachedOpen(nextOpen);
            setControlledDetachedTriggerId(eventDetails.trigger?.id ?? null);
          }}
        />
        <StyledTrigger handle={controlledDetachedDialog} payload={triggerLabels[0]}>
          {triggerLabels[0]}
        </StyledTrigger>
        <StyledTrigger
          handle={controlledDetachedDialog}
          payload={triggerLabels[1]}
          id="detached-second-trigger"
        >
          {triggerLabels[1]}
        </StyledTrigger>
        <StyledTrigger handle={controlledDetachedDialog} payload={triggerLabels[2]}>
          {triggerLabels[2]}
        </StyledTrigger>
        <StyledTrigger handle={controlledDetachedDialog} payload={triggerLabels[3]}>
          {triggerLabels[3]}
        </StyledTrigger>
        <button
          type="button"
          className={clsx(demoStyles.Button, styles.Button)}
          onClick={() => {
            setControlledDetachedOpen(true);
            setControlledDetachedTriggerId('detached-second-trigger');
          }}
        >
          Controlled open (Invites)
        </button>
      </div>

      <h2>Handle-controlled dialog</h2>
      <div className={styles.Container}>
        <StyledDialog handle={handleControlledDialog} />
        <StyledTrigger handle={handleControlledDialog} payload={triggerLabels[0]}>
          {triggerLabels[0]}
        </StyledTrigger>
        <StyledTrigger
          handle={handleControlledDialog}
          payload={triggerLabels[1]}
          id="handle-controlled-second-trigger"
        >
          {triggerLabels[1]}
        </StyledTrigger>
        <StyledTrigger handle={handleControlledDialog} payload={triggerLabels[2]}>
          {triggerLabels[2]}
        </StyledTrigger>

        <button
          type="button"
          className={clsx(demoStyles.Button, styles.Button)}
          onClick={() => {
            handleControlledDialog.open('handle-controlled-second-trigger');
          }}
        >
          Open (Invites)
        </button>

        <button
          type="button"
          className={clsx(demoStyles.Button, styles.Button)}
          onClick={() => {
            handleControlledDialog.open(null);
          }}
        >
          Open (unassigned trigger, should display nothing)
        </button>

        <button
          type="button"
          className={clsx(demoStyles.Button, styles.Button)}
          onClick={() => {
            handleControlledDialog.openWithPayload('Notifications');
          }}
        >
          Open (unassigned trigger, custom payload)
        </button>
      </div>
    </div>
  );
}

type StyledDialogProps<Payload> = Pick<
  Dialog.Root.Props<Payload>,
  'handle' | 'open' | 'onOpenChange' | 'triggerId'
>;

function StyledTrigger<Payload>(
  props: Dialog.Trigger.Props<Payload> & React.RefAttributes<HTMLButtonElement>,
) {
  const { className, children, ...other } = props;
  const combinedClassName = clsx(demoStyles.Button, styles.Button, className);

  return (
    <Dialog.Trigger {...other} className={combinedClassName}>
      {children}
    </Dialog.Trigger>
  );
}

function StyledDialog(props: StyledDialogProps<keyof typeof dialogContents>) {
  const { handle, open, onOpenChange, triggerId } = props;
  const { settings } = useExperimentSettings<Settings>();

  return (
    <Dialog.Root
      handle={handle}
      open={open}
      onOpenChange={onOpenChange}
      triggerId={triggerId}
      modal={settings.modal}
      disablePointerDismissal={settings.disablePointerDismissal}
    >
      {({ payload }) => renderDialogContent(payload as keyof typeof dialogContents, settings)}
    </Dialog.Root>
  );
}

function renderDialogContent(contentKey: keyof typeof dialogContents, settings: Settings) {
  const content = dialogContents[contentKey];

  return (
    <Dialog.Portal keepMounted={settings.keepMounted}>
      {settings.renderBackdrop && <Dialog.Backdrop className={demoStyles.Backdrop} />}
      <Dialog.Popup className={demoStyles.Popup} key={contentKey}>
        {contentKey == null ? (
          <p>No payload</p>
        ) : (
          <React.Fragment>
            <Dialog.Title className={demoStyles.Title}>{contentKey}</Dialog.Title>
            <Dialog.Description className={demoStyles.Description}>
              Example dialog for {contentKey}.
            </Dialog.Description>
            <div className={styles.DialogSection}>{content}</div>
            <div className={styles.DialogSection}>
              <StatefulComponent />
            </div>
            <div className={clsx(demoStyles.Actions, styles.Actions)}>
              <Dialog.Close className={clsx(demoStyles.Button, styles.Button)}>Close</Dialog.Close>
            </div>
          </React.Fragment>
        )}
      </Dialog.Popup>
    </Dialog.Portal>
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
    label: 'Disable pointer dismissal',
    default: false,
  },
  keepMounted: {
    type: 'boolean',
    label: 'Keep mounted',
    default: false,
  },
  renderBackdrop: {
    type: 'boolean',
    label: 'Render backdrop',
    default: true,
  },
};

function StatefulComponent() {
  const [note, setNote] = React.useState('');

  return (
    <div className={styles.Form}>
      <label className={styles.Label}>
        Quick note (stateful component to verify correct resetting):
        <input
          className={styles.Input}
          type="text"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Capture an idea"
        />
      </label>
    </div>
  );
}
