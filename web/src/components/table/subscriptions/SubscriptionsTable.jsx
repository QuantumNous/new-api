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

// /console/subscription table — thin glue around the shared HeroTable
// wrapper so the subscriptions view inherits the same row rhythm,
// sticky-right operations column, hover bg, empty state and loading
// spinner as /console/token, /console/channel, /console/user and
// /console/redemption.
//
// Previously this used the legacy `CardTable` wrapper which is built
// on a hand-rolled `<table>` and renders its empty state as a separate
// surface card outside the table. HeroTable (HeroUI Table + React
// Aria) renders the empty state inline via `renderEmptyState`, paints
// rows with the design-system surface tokens, and routes
// `fixed: 'right'` columns through the wrapper's sticky-right glue.

import React, { useMemo } from 'react';
import HeroTable from '../../common/ui/HeroTable';
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

  // Compact mode strips `fixed` from the operations column so it
  // joins the natural horizontal flow instead of being pinned right.
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
    <HeroTable
      ariaLabel={t('订阅套餐列表')}
      columns={tableColumns}
      dataSource={plans || []}
      rowKey={(row) => row?.plan?.id}
      loading={loading}
      emptyDescription={t('暂无订阅套餐')}
      // Disabled plans are dimmed — same opacity treatment the other
      // four admin tables use for soft-disabled rows.
      rowClassName={(record) =>
        record?.plan?.enabled === false ? 'opacity-60' : ''
      }
    />
  );
};

export default SubscriptionsTable;
