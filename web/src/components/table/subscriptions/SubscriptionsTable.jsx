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
