import { Tabs, TabPane } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import { useUserModelStats } from '../../hooks/user-model-stats/useUserModelStats';
import { UserModelStatsFilters } from './UserModelStatsFilters';
import { UserModelStatsTable } from './UserModelStatsTable';

export const UserModelStatsPage = () => {
  const { t } = useTranslation();
  const {
    activeTab,
    setActiveTab,
    loading,
    listData,
    inputs,
    pagination,
    setPagination,
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
          <UserModelStatsTable
            items={listData.items}
            loading={loading}
            pagination={{ page: listData.page, pageSize: listData.page_size, total: listData.total }}
            onPaginationChange={setPagination}
            t={t}
            type='userTotal'
          />
        </TabPane>
        <TabPane tab={t('模型视角')} itemKey='byModel'>
          <UserModelStatsTable
            items={listData.items}
            loading={loading}
            pagination={{ page: listData.page, pageSize: listData.page_size, total: listData.total }}
            onPaginationChange={setPagination}
            t={t}
            type='modelTotal'
          />
        </TabPane>
        <TabPane tab={t('用户模型消耗')} itemKey='byDetail'>
          <UserModelStatsTable
            items={listData.items}
            loading={loading}
            pagination={{ page: listData.page, pageSize: listData.page_size, total: listData.total }}
            onPaginationChange={setPagination}
            t={t}
            type='detail'
          />
        </TabPane>
      </Tabs>
    </div>
  );
};
