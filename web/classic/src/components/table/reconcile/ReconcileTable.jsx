/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import React, { useMemo } from 'react';
import { Empty } from '@douyinfe/semi-ui';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import CardTable from '../../common/ui/CardTable';
import { getReconcileColumns } from './ReconcileColumnDefs';

const ReconcileTable = ({ rows, loading, compactMode, t }) => {
  const columns = useMemo(() => getReconcileColumns(t), [t]);

  // Compact mode strips fixed/width like users-table does, so the table fits
  // the container and stops requiring horizontal scroll.
  const tableColumns = useMemo(
    () =>
      compactMode
        ? columns.map(({ fixed, width, ...rest }) => rest)
        : columns,
    [compactMode, columns],
  );

  return (
    <CardTable
      columns={tableColumns}
      dataSource={rows}
      loading={loading}
      hidePagination={true}
      scroll={compactMode ? undefined : { x: 'max-content' }}
      size='middle'
      className='overflow-hidden'
      empty={
        <Empty
          image={<IllustrationNoResult style={{ width: 150, height: 150 }} />}
          darkModeImage={
            <IllustrationNoResultDark style={{ width: 150, height: 150 }} />
          }
          title={t('暂无对账数据')}
          description={t('该时段尚未聚合，或聚合任务还未跑到该时段')}
        />
      }
    />
  );
};

export default ReconcileTable;
