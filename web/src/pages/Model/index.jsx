import React from 'react';
import ModelsTable from '../../components/table/models';
import ConsolePageShell from '../../components/layout/ConsolePageShell';

const ModelPage = () => {
  return (
    <ConsolePageShell>
      <ModelsTable />
    </ConsolePageShell>
  );
};

export default ModelPage;
