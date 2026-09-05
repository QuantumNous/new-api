import * as React from 'react';
import clsx from 'clsx';
import { ExperimentsList } from './ExperimentsList';
import { EditPanel } from './EditPanel';
import classes from './Sidebar.module.css';
import { HideSidebar } from './HideSidebar';
import { SettingsMetadata, SettingsPanel } from './SettingsPanel';

export function Sidebar(props: SidebarProps) {
  const { experimentPath, settingsMetadata, className, ...otherProps } = props;

  return (
    <div {...otherProps} className={clsx(classes.root, className)}>
      {experimentPath && (
        <React.Fragment>
          {settingsMetadata && (
            <SettingsPanel
              className={classes.panel}
              metadata={settingsMetadata}
              renderAsPopup={false}
            />
          )}
          <EditPanel className={classes.panel} experimentPath={experimentPath} />
          <HideSidebar className={classes.panel} />
        </React.Fragment>
      )}
      <ExperimentsList className={classes.panel} />
    </div>
  );
}

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  experimentPath?: string;
  settingsMetadata?: SettingsMetadata<unknown>;
}
