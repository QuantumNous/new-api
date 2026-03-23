import React from 'react';
import DeploymentsTable from '../../components/table/model-deployments';
import ConsolePageShell from '../../components/layout/ConsolePageShell';
import DeploymentAccessGuard from '../../components/model-deployments/DeploymentAccessGuard';
import { useModelDeploymentSettings } from '../../hooks/model-deployments/useModelDeploymentSettings';

const ModelDeploymentPage = () => {
  const {
    loading,
    isIoNetEnabled,
    connectionLoading,
    connectionOk,
    connectionError,
    testConnection,
  } = useModelDeploymentSettings();

  return (
    <DeploymentAccessGuard
      loading={loading}
      isEnabled={isIoNetEnabled}
      connectionLoading={connectionLoading}
      connectionOk={connectionOk}
      connectionError={connectionError}
      onRetry={() => testConnection()}
    >
      <ConsolePageShell>
        <DeploymentsTable />
      </ConsolePageShell>
    </DeploymentAccessGuard>
  );
};

export default ModelDeploymentPage;
