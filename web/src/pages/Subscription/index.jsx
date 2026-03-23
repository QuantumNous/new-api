import React from 'react';
import SubscriptionsPage from '../../components/table/subscriptions';
import ConsolePageShell from '../../components/layout/ConsolePageShell';

const Subscription = () => {
  return (
    <ConsolePageShell>
      <SubscriptionsPage />
    </ConsolePageShell>
  );
};

export default Subscription;
