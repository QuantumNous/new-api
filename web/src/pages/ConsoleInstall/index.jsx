import React from 'react';
import ConsolePageShell from '../../components/layout/ConsolePageShell';
import ConsoleInstallPage from '../../components/console-docs/ConsoleInstallPage';

const ConsoleInstall = ({ productId }) => (
  <ConsolePageShell contentClassName='console-page-shell__inner--workspace'>
    <ConsoleInstallPage productId={productId} />
  </ConsolePageShell>
);

export default ConsoleInstall;
