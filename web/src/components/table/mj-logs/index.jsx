import React from 'react';
import { Layout } from '@douyinfe/semi-ui';
import CardPro from '../../common/ui/CardPro';
import MjLogsTable from './MjLogsTable';
import MjLogsActions from './MjLogsActions';
import MjLogsFilters from './MjLogsFilters';
import ColumnSelectorModal from './modals/ColumnSelectorModal';
import ContentModal from './modals/ContentModal';
import { useMjLogsData } from '../../../hooks/mj-logs/useMjLogsData';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
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
          type='type2'
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
