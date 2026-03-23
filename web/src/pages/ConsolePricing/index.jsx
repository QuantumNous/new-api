import React from 'react';
import ConsolePageShell from '../../components/layout/ConsolePageShell';
import ConsolePricingPage from '../../components/pricing/ConsolePricingPage';

const ConsolePricing = () => (
  <ConsolePageShell contentClassName='console-page-shell__inner--workspace'>
    <ConsolePricingPage />
  </ConsolePageShell>
);

export default ConsolePricing;
