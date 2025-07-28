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
import CardPro from '../../common/ui/CardPro.js';
import LogsTable from './UsageLogsTable.jsx';
import LogsActions from './UsageLogsActions.jsx';
import LogsFilters from './UsageLogsFilters.jsx';
import ColumnSelectorModal from './modals/ColumnSelectorModal.jsx';
import UserInfoModal from './modals/UserInfoModal.jsx';
import { useLogsData } from '../../../hooks/usage-logs/useUsageLogsData.js';
import { useIsMobile } from '../../../hooks/common/useIsMobile.js';
import { createCardProPagination } from '../../../helpers/utils';

const LogsPage = () => {
  const logsData = useLogsData();
  const isMobile = useIsMobile();

  return (
    <>
      {/* Modals */}
      <ColumnSelectorModal {...logsData} />
      <UserInfoModal {...logsData} />

      {/* Main Content */}
      <CardPro
        type="type2"
        statsArea={<LogsActions {...logsData} />}
        searchArea={<LogsFilters {...logsData} />}
        paginationArea={createCardProPagination({
          currentPage: logsData.activePage,
          pageSize: logsData.pageSize,
          total: logsData.logCount,
          onPageChange: logsData.handlePageChange,
          onPageSizeChange: logsData.handlePageSizeChange,
          isMobile: isMobile,
          t: logsData.t,
        })}
        t={logsData.t}
      >
        <LogsTable {...logsData} />
      </CardPro>
    </>
  );
};

export default LogsPage; 