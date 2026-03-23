import React from 'react';
import UsersTable from '../../components/table/users';
import ConsolePageShell from '../../components/layout/ConsolePageShell';

const User = () => {
  return (
    <ConsolePageShell>
      <UsersTable />
    </ConsolePageShell>
  );
};

export default User;
