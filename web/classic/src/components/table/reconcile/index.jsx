/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/

import React from 'react';
import CardPro from '../../common/ui/CardPro';
import ReconcileTable from './ReconcileTable';
import ReconcileActions from './ReconcileActions';
import ReconcileFilters from './ReconcileFilters';
import { useReconcileData } from '../../../hooks/reconcile/useReconcileData';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
import { createCardProPagination } from '../../../helpers/utils';

// Reconcile management page — single viewer of reconcile_hourly with channel
// filter, date range filter (default = last calendar month), pagination, and
// an Export button that downloads the matching month as xlsx for manual
// comparison against the supplier bill in Excel.
const ReconcilePage = () => {
  const data = useReconcileData();
  const isMobile = useIsMobile();

  return (
    <CardPro
      type='type2'
      statsArea={<ReconcileActions {...data} />}
      searchArea={<ReconcileFilters {...data} />}
      paginationArea={createCardProPagination({
        currentPage: data.activePage,
        pageSize: data.pageSize,
        total: data.total,
        onPageChange: data.handlePageChange,
        onPageSizeChange: data.handlePageSizeChange,
        isMobile: isMobile,
        t: data.t,
      })}
      t={data.t}
    >
      <ReconcileTable {...data} />
    </CardPro>
  );
};

export default ReconcilePage;
