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

import React from 'react';
import { Layout } from '@douyinfe/semi-ui';
import CardPro from '../../common/ui/CardPro';
import ErrorLogsTable from './ErrorLogsTable';
import ErrorLogsActions from './ErrorLogsActions';
import ErrorLogsFilters from './ErrorLogsFilters';
import ColumnSelectorModal from './modals/ColumnSelectorModal';
import ContentModal from '../task-logs/modals/ContentModal';
import { useErrorLogsData } from '../../../hooks/error-logs/useErrorLogsData';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
import { createCardProPagination } from '../../../helpers/utils';

const ErrorLogsPage = () => {
  const errorLogsData = useErrorLogsData();
  const isMobile = useIsMobile();

  return (
    <>
      <ColumnSelectorModal {...errorLogsData} />
      <ContentModal {...errorLogsData} isVideo={false} />

      <Layout>
        <CardPro
          type='type2'
          statsArea={<ErrorLogsActions {...errorLogsData} />}
          searchArea={<ErrorLogsFilters {...errorLogsData} />}
          paginationArea={createCardProPagination({
            currentPage: errorLogsData.activePage,
            pageSize: errorLogsData.pageSize,
            total: errorLogsData.logCount,
            onPageChange: errorLogsData.handlePageChange,
            onPageSizeChange: errorLogsData.handlePageSizeChange,
            isMobile: isMobile,
            t: errorLogsData.t,
          })}
          t={errorLogsData.t}
        >
          <ErrorLogsTable {...errorLogsData} />
        </CardPro>
      </Layout>
    </>
  );
};

export default ErrorLogsPage;
