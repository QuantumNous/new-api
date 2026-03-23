import React from 'react';
import ConsolePageShell from '../../components/layout/ConsolePageShell';
import ConsoleTutorialPage from '../../components/console-docs/ConsoleTutorialPage';

const Tutorial = () => (
  <ConsolePageShell
    className='console-page-shell--public'
    contentClassName='console-page-shell__inner--workspace'
  >
    <ConsoleTutorialPage />
  </ConsolePageShell>
);

export default Tutorial;
