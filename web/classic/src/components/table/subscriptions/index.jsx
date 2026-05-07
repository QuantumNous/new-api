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

import React, { useContext, useMemo, useState } from 'react';
import { Banner, Tabs } from '@douyinfe/semi-ui';
import { API, showError, showSuccess } from '../../../helpers';
import CardPro from '../../common/ui/CardPro';
import SubscriptionsTable from './SubscriptionsTable';
import SubscriptionsActions from './SubscriptionsActions';
import SubscriptionsDescription from './SubscriptionsDescription';
import AddEditSubscriptionModal from './modals/AddEditSubscriptionModal';
import SubscriptionUsageView from './SubscriptionUsageView';
import { useSubscriptionsData } from '../../../hooks/subscriptions/useSubscriptionsData';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
import { createCardProPagination } from '../../../helpers/utils';
import { StatusContext } from '../../../context/Status';

const SubscriptionsPage = () => {
  const subscriptionsData = useSubscriptionsData();
  const isMobile = useIsMobile();
  const [statusState] = useContext(StatusContext);
  const enableEpay = !!statusState?.status?.enable_online_topup;
  const [activeTab, setActiveTab] = useState('plans');

  const {
    showEdit,
    editingPlan,
    sheetPlacement,
    closeEdit,
    refresh,
    openCreate,
    compactMode,
    setCompactMode,
    t,
  } = subscriptionsData;

  const tabList = useMemo(
    () => [
      { itemKey: 'plans', tab: t('套餐管理') },
      { itemKey: 'usage-plan', tab: t('套餐用量') },
      { itemKey: 'usage-inactive', tab: t('非活跃用户') },
    ],
    [t],
  );

  const syncMissingGroupSubscriptionsByPlan = async (plan) => {
    const bindGroup = (plan?.bind_group || '').trim();
    if (!bindGroup) {
      showError(t('该套餐未绑定分组'));
      return;
    }
    try {
      const res = await API.post('/api/user/group-sync', {
        full: false,
        group_name: bindGroup,
        only_missing: true,
      });
      if (res.data?.success) {
        const data = res.data?.data || {};
        showSuccess(
          `${t('同步完成')} | ${t('更新')}: ${data.updated || 0}, ${t('跳过')}: ${data.skipped || 0}, ${t('错误')}: ${(data.errors || []).length}`,
        );
      } else {
        showError(res.data?.message || t('同步失败'));
      }
    } catch (e) {
      showError(e.message || t('同步失败'));
    }
  };

  const renderTabContent = () => {
    if (activeTab === 'plans') {
      return (
        <SubscriptionsTable
          {...subscriptionsData}
          enableEpay={enableEpay}
          onManualSyncPlanGroup={syncMissingGroupSubscriptionsByPlan}
        />
      );
    }
    if (activeTab === 'usage-plan') {
      return <SubscriptionUsageView t={t} viewType='plan' />;
    }
    return <SubscriptionUsageView t={t} viewType='inactive' />;
  };

  return (
    <>
      <AddEditSubscriptionModal
        visible={showEdit}
        handleClose={closeEdit}
        editingPlan={editingPlan}
        placement={sheetPlacement}
        refresh={refresh}
        t={t}
      />

      <CardPro
        type='type1'
        descriptionArea={
          <SubscriptionsDescription
            compactMode={compactMode}
            setCompactMode={setCompactMode}
            t={t}
          />
        }
        actionsArea={
          <div className='flex flex-col md:flex-row justify-between items-start md:items-center gap-2 w-full'>
            <div className='order-1 md:order-0 w-full md:w-auto'>
              <SubscriptionsActions openCreate={openCreate} t={t} />
            </div>
            <Banner
              type='info'
              description={t('Stripe/Creem 需在第三方平台创建商品并填入 ID')}
              closeIcon={null}
              className='!rounded-lg order-2 md:order-1'
              style={{ maxWidth: '100%' }}
            />
          </div>
        }
        paginationArea={createCardProPagination({
          currentPage: subscriptionsData.activePage,
          pageSize: subscriptionsData.pageSize,
          total: subscriptionsData.planCount,
          onPageChange: subscriptionsData.handlePageChange,
          onPageSizeChange: subscriptionsData.handlePageSizeChange,
          isMobile,
          t: subscriptionsData.t,
        })}
        t={t}
      >
        <Tabs
          type='line'
          activeKey={activeTab}
          onChange={setActiveTab}
          tabList={tabList}
        />
        {renderTabContent()}
      </CardPro>
    </>
  );
};

export default SubscriptionsPage;
