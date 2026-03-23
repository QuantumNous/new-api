import React from 'react';
import TokensTable from '../../components/table/tokens';
import ConsolePageShell from '../../components/layout/ConsolePageShell';

const Token = () => {
  return (
    <ConsolePageShell>
      <TokensTable />
    </ConsolePageShell>
  );
};

export default Token;
