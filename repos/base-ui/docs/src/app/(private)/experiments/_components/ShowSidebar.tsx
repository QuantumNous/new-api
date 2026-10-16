'use client';
import * as React from 'react';
import { ExperimentRootContext } from './ExperimentRoot';
import classes from './ShowSidebar.module.css';

export function ShowSidebar() {
  const rootContext = React.useContext(ExperimentRootContext);
  if (!rootContext) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => rootContext.setSidebarVisible(true)}
      className={classes.root}
      title="Show sidebar"
      aria-label="Show sidebar"
    />
  );
}
