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
import { Banner } from '@douyinfe/semi-ui';
import { IconAlertTriangle } from '@douyinfe/semi-icons';
import { Activity, Boxes, GitBranch, Route, ShieldAlert } from 'lucide-react';
import CardPro from '../../common/ui/CardPro';
import ChannelsTable from './ChannelsTable';
import ChannelsActions from './ChannelsActions';
import ChannelsFilters from './ChannelsFilters';
import ChannelsTabs from './ChannelsTabs';
import { useChannelsData } from '../../../hooks/channels/useChannelsData';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
import BatchTagModal from './modals/BatchTagModal';
import ModelTestModal from './modals/ModelTestModal';
import ColumnSelectorModal from './modals/ColumnSelectorModal';
import EditChannelModal from './modals/EditChannelModal';
import EditTagModal from './modals/EditTagModal';
import MultiKeyManageModal from './modals/MultiKeyManageModal';
import ChannelUpstreamUpdateModal from './modals/ChannelUpstreamUpdateModal';
import { createCardProPagination } from '../../../helpers/utils';

const ChannelsPage = () => {
  const channelsData = useChannelsData();
  const isMobile = useIsMobile();
  const visibleChannelCount = channelsData.channels?.length || 0;
  const selectedCount = channelsData.selectedChannels?.length || 0;
  const enabledTypeCount = channelsData.availableTypeKeys?.length || 0;
  const channelSummaryItems = [
    {
      icon: Boxes,
      label: channelsData.t('渠道总数'),
      value: channelsData.channelCount,
    },
    {
      icon: Activity,
      label: channelsData.t('当前视图'),
      value: visibleChannelCount,
    },
    {
      icon: GitBranch,
      label: channelsData.t('供应商类型'),
      value: enabledTypeCount,
    },
    {
      icon: Route,
      label: channelsData.t('已选择'),
      value: selectedCount,
    },
  ];

  return (
    <div className='na-channel-console'>
      {/* Modals */}
      <ColumnSelectorModal {...channelsData} />
      <EditTagModal
        visible={channelsData.showEditTag}
        tag={channelsData.editingTag}
        handleClose={() => channelsData.setShowEditTag(false)}
        refresh={channelsData.refresh}
      />
      <EditChannelModal
        refresh={channelsData.refresh}
        visible={channelsData.showEdit}
        handleClose={channelsData.closeEdit}
        editingChannel={channelsData.editingChannel}
      />
      <BatchTagModal {...channelsData} />
      <ModelTestModal {...channelsData} />
      <MultiKeyManageModal
        visible={channelsData.showMultiKeyManageModal}
        onCancel={() => channelsData.setShowMultiKeyManageModal(false)}
        channel={channelsData.currentMultiKeyChannel}
        onRefresh={channelsData.refresh}
      />
      <ChannelUpstreamUpdateModal
        visible={channelsData.showUpstreamUpdateModal}
        addModels={channelsData.upstreamUpdateAddModels}
        removeModels={channelsData.upstreamUpdateRemoveModels}
        preferredTab={channelsData.upstreamUpdatePreferredTab}
        confirmLoading={channelsData.upstreamApplyLoading}
        onConfirm={channelsData.applyUpstreamUpdates}
        onCancel={channelsData.closeUpstreamUpdateModal}
      />

      <section className='na-channel-console-hero'>
        <div>
          <p className='na-channel-console-eyebrow'>
            {channelsData.t('渠道供应链')}
          </p>
          <h1 className='na-channel-console-title'>
            {channelsData.t('渠道管理')}
          </h1>
          <p className='na-channel-console-copy'>
            {channelsData.t(
              '统一维护上游供应商、模型能力、权重优先级、余额和健康状态。',
            )}
          </p>
        </div>
        <div
          className={`na-channel-console-risk ${
            channelsData.globalPassThroughEnabled
              ? 'na-channel-console-risk-warning'
              : ''
          }`}
        >
          <ShieldAlert size={16} />
          <span>
            {channelsData.globalPassThroughEnabled
              ? channelsData.t('全局透传已开启')
              : channelsData.t('内置适配生效中')}
          </span>
        </div>
      </section>

      <section className='na-channel-summary-strip'>
        {channelSummaryItems.map((item) => {
          const Icon = item.icon;
          return (
            <article className='na-channel-summary-item' key={item.label}>
              <Icon className='na-channel-summary-icon' aria-hidden />
              <div>
                <p>{item.label}</p>
                <strong>{item.value}</strong>
              </div>
            </article>
          );
        })}
      </section>

      {/* Main Content */}
      {channelsData.globalPassThroughEnabled ? (
        <Banner
          type='warning'
          closeIcon={null}
          icon={
            <IconAlertTriangle
              size='large'
              style={{ color: 'var(--semi-color-warning)' }}
            />
          }
          description={channelsData.t(
            '已开启全局请求透传：参数覆写、模型重定向、渠道适配等 NewAPI 内置功能将失效，非最佳实践；如因此产生问题，请勿提交 issue 反馈。',
          )}
          className='na-channel-warning-banner'
        />
      ) : null}

      <section className='na-channel-table-workbench'>
        <CardPro
          type='type3'
          tabsArea={<ChannelsTabs {...channelsData} />}
          actionsArea={<ChannelsActions {...channelsData} />}
          searchArea={<ChannelsFilters {...channelsData} />}
          paginationArea={createCardProPagination({
            currentPage: channelsData.activePage,
            pageSize: channelsData.pageSize,
            total: channelsData.channelCount,
            onPageChange: channelsData.handlePageChange,
            onPageSizeChange: channelsData.handlePageSizeChange,
            isMobile: isMobile,
            t: channelsData.t,
          })}
          t={channelsData.t}
        >
          <ChannelsTable {...channelsData} />
        </CardPro>
      </section>
    </div>
  );
};

export default ChannelsPage;
