import { Tabs, TabPane } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { useUserModelStats } from '../../hooks/user-model-stats/useUserModelStats';
import { UserModelStatsFilters } from './UserModelStatsFilters';
import { UserModelStatsTable } from './UserModelStatsTable';
import { UserModelStatsMatrixTable } from './UserModelStatsMatrixTable';
import { UserModelStatsBars } from './UserModelStatsBars';

export const UserModelStatsPage = () => {
  const { t } = useTranslation();
  const {
    activeTab,
    setActiveTab,
    loading,
    listData,
    matrixData,
    inputs,
    setPagination,
    matrixPagination,
    setMatrixPagination,
    matrixPivot,
    setMatrixPivot,
    handleInputChange,
    handleSearch,
    handleExport,
  } = useUserModelStats();

  return (
    <div className='mt-[60px] px-2'>
      <div className='mb-4'>
        <h2 className='text-xl font-semibold'>{t('用户模型统计')}</h2>
        <p className='text-sm text-gray-500'>{t('数据来自 quota_data 聚合表')}</p>
      </div>

      <UserModelStatsFilters
        inputs={inputs}
        onInputChange={handleInputChange}
        onSearch={handleSearch}
        onExport={handleExport}
        t={t}
      />

      <Tabs activeKey={activeTab} onChange={setActiveTab} type='line'>
        <TabPane tab={t('用户视角')} itemKey='byUser'>
          <UserModelStatsBars items={listData.items} activeTab={activeTab} t={t} />
          <UserModelStatsTable
            items={listData.items}
            loading={loading}
            pagination={{ page: listData.page, pageSize: listData.page_size, total: listData.total }}
            onPaginationChange={setPagination}
            t={t}
            type='detail'
          />
        </TabPane>
        <TabPane tab={t('模型视角')} itemKey='byModel'>
          <UserModelStatsBars items={listData.items} activeTab={activeTab} t={t} />
          <UserModelStatsTable
            items={listData.items}
            loading={loading}
            pagination={{ page: listData.page, pageSize: listData.page_size, total: listData.total }}
            onPaginationChange={setPagination}
            t={t}
            type='detail'
          />
        </TabPane>
        <TabPane tab={t('交叉矩阵')} itemKey='matrix'>
          <UserModelStatsMatrixTable
            data={matrixData}
            loading={loading}
            matrixPivot={matrixPivot}
            onPivotChange={setMatrixPivot}
            matrixPagination={matrixPagination}
            onMatrixPaginationChange={setMatrixPagination}
            t={t}
          />
        </TabPane>
      </Tabs>
    </div>
  );
};
