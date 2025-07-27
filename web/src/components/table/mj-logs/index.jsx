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
import CardPro from '../../common/ui/CardPro.js';
import MjLogsTable from './MjLogsTable.jsx';
import MjLogsActions from './MjLogsActions.jsx';
import MjLogsFilters from './MjLogsFilters.jsx';
import ColumnSelectorModal from './modals/ColumnSelectorModal.jsx';
import ContentModal from './modals/ContentModal.jsx';
import { useMjLogsData } from '../../../hooks/mj-logs/useMjLogsData.js';
import { useIsMobile } from '../../../hooks/common/useIsMobile.js';
import { createCardProPagination } from '../../../helpers/utils';

const MjLogsPage = () => {
  const mjLogsData = useMjLogsData();
  const isMobile = useIsMobile();

  return (
    <>
      {/* Modals */}
      <ColumnSelectorModal {...mjLogsData} />
      <ContentModal {...mjLogsData} />

      <Layout>
        <CardPro
          type="type2"
          statsArea={<MjLogsActions {...mjLogsData} />}
          searchArea={<MjLogsFilters {...mjLogsData} />}
          paginationArea={createCardProPagination({
            currentPage: mjLogsData.activePage,
            pageSize: mjLogsData.pageSize,
            total: mjLogsData.logCount,
            onPageChange: mjLogsData.handlePageChange,
            onPageSizeChange: mjLogsData.handlePageSizeChange,
            isMobile: isMobile,
            t: mjLogsData.t,
          })}
          t={mjLogsData.t}
        >
          <MjLogsTable {...mjLogsData} />
        </CardPro>
      </Layout>
    </>
  );
};

export default MjLogsPage; 