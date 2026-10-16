'use client';
import * as React from 'react';
import clsx from 'clsx';
import { ShowSidebar } from './ShowSidebar';
import classes from './ExperimentRoot.module.css';

export interface ExperimentRootContext {
  sidebarVisible: boolean;
  setSidebarVisible: React.Dispatch<React.SetStateAction<boolean>>;
}

export const ExperimentRootContext = React.createContext<ExperimentRootContext | undefined>(
  undefined,
);

export function ExperimentRoot(props: ExperimentRootProps) {
  const { children, sidebar } = props;
  const [sidebarVisible, setSidebarVisible] = React.useState(true);

  const rootContext = React.useMemo(
    () => ({
      sidebarVisible,
      setSidebarVisible,
    }),
    [sidebarVisible],
  );

  return (
    <ExperimentRootContext value={rootContext}>
      <div className={clsx(classes.root, sidebarVisible && classes.withSidebar)}>
        {sidebarVisible ? sidebar : <ShowSidebar />}
        <main className={classes.main}>{children}</main>
      </div>
    </ExperimentRootContext>
  );
}

export interface ExperimentRootProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
}
