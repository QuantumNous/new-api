import React from 'react';
import TaskLogsTable from '../../components/table/task-logs';
import ConsolePageShell from '../../components/layout/ConsolePageShell';

const Task = () => (
  <ConsolePageShell>
    <TaskLogsTable />
  </ConsolePageShell>
);

export default Task;
