/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useMemo } from 'react';
import { Empty } from '@douyinfe/semi-ui';
import CardTable from '../../common/ui/CardTable';
import {
  IllustrationNoResult,
  IllustrationNoResultDark,
} from '@douyinfe/semi-illustrations';
import { getSubscriptionsColumns } from './SubscriptionsColumnDefs';

const SubscriptionsTable = (subscriptionsData) => {
  const {
    plans,
    loading,
    compactMode,
    openEdit,
    setPlanEnabled,
    t,
    enableEpay,
  } = subscriptionsData;

  const columns = useMemo(() => {
    return getSubscriptionsColumns({
      t,
      openEdit,
      setPlanEnabled,
      enableEpay,
    });
  }, [t, openEdit, setPlanEnabled, enableEpay]);

  const tableColumns = useMemo(() => {
    return compactMode
      ? columns.map((col) => {
          if (col.dataIndex === 'operate') {
            const { fixed, ...rest } = col;
            return rest;
          }
          return col;
        })
      : columns;
  }, [compactMode, columns]);

  return (
    <CardTable
      columns={tableColumns}
      dataSource={plans}
      scroll={compactMode ? undefined : { x: 'max-content' }}
      pagination={false}
      hidePagination={true}
      loading={loading}
      rowKey={(row) => row?.plan?.id}
      empty={
        <Empty
          image={<IllustrationNoResult style={{ width: 150, height: 150 }} />}
          darkModeImage={
            <IllustrationNoResultDark style={{ width: 150, height: 150 }} />
          }
          description={t('暂无订阅套餐')}
          style={{ padding: 30 }}
        />
      }
      className='overflow-hidden'
      size='middle'
    />
  );
};

export default SubscriptionsTable;
