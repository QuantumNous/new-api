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
import { Layout, ImagePreview } from '@douyinfe/semi-ui';
import PricingSidebar from './PricingSidebar';
import PricingContent from './content/PricingContent';
import ModelDetailSideSheet from '../modal/ModelDetailSideSheet';
import { useModelPricingData } from '../../../../hooks/model-pricing/useModelPricingData';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';

const PricingPage = () => {
  const pricingData = useModelPricingData();
  const { Sider, Content } = Layout;
  const isMobile = useIsMobile();
  const [showRatio, setShowRatio] = React.useState(false);
  const [viewMode, setViewMode] = React.useState('card');
  const vendorCount = Object.keys(pricingData.vendorsMap || {}).length;
  const groupCount = Object.keys(pricingData.usableGroup || {}).filter(
    (key) => key !== '',
  ).length;
  const activeFilters = [
    pricingData.filterVendor && pricingData.filterVendor !== 'all'
      ? {
          key: 'vendor',
          label: pricingData.t('供应商'),
          value:
            pricingData.filterVendor === 'unknown'
              ? pricingData.t('未知供应商')
              : pricingData.filterVendor,
        }
      : null,
    pricingData.filterGroup && pricingData.filterGroup !== 'all'
      ? {
          key: 'group',
          label: pricingData.t('分组'),
          value: pricingData.filterGroup,
        }
      : null,
    pricingData.filterQuotaType && pricingData.filterQuotaType !== 'all'
      ? {
          key: 'quota',
          label: pricingData.t('计费'),
          value:
            String(pricingData.filterQuotaType) === '1'
              ? pricingData.t('按次')
              : pricingData.t('按量'),
        }
      : null,
    pricingData.filterEndpointType && pricingData.filterEndpointType !== 'all'
      ? {
          key: 'endpoint',
          label: pricingData.t('端点'),
          value: pricingData.filterEndpointType,
        }
      : null,
    pricingData.filterTag && pricingData.filterTag !== 'all'
      ? {
          key: 'tag',
          label: pricingData.t('标签'),
          value: pricingData.filterTag,
        }
      : null,
  ].filter(Boolean);
  const totalModelCount = pricingData.models.length;
  const filteredModelCount = pricingData.filteredModels.length;
  const displayModeLabel =
    viewMode === 'table'
      ? pricingData.t('表格视图')
      : pricingData.t('卡片视图');
  const billingUnitLabel =
    pricingData.siteDisplayType === 'TOKENS'
      ? pricingData.t('{{unit}} Token 单位', { unit: pricingData.tokenUnit })
      : showRatio
        ? pricingData.t('{{currency}} + 倍率', {
            currency: pricingData.showWithRecharge
              ? pricingData.currency
              : pricingData.t('基础价格'),
          })
        : pricingData.showWithRecharge
          ? pricingData.currency
          : pricingData.t('基础价格');
  const allProps = {
    ...pricingData,
    showRatio,
    setShowRatio,
    viewMode,
    setViewMode,
  };

  return (
    <div className='pricing-page-surface'>
      <div className='pricing-overview'>
        <div className='pricing-overview-copy'>
          <div className='pricing-overview-mainline'>
            <div className='pricing-overview-heading'>
              <div className='pricing-overview-kicker'>
                {pricingData.t('模型广场')}
              </div>
              <h1 className='pricing-overview-title'>
                {pricingData.t('模型定价')}
              </h1>
            </div>

            <div className='pricing-overview-inline-meta'>
              <span className='pricing-overview-inline-chip'>
                <em>{pricingData.t('结果')}</em>
                <strong>
                  {filteredModelCount}/{totalModelCount}
                </strong>
              </span>
              <span className='pricing-overview-inline-chip'>
                <em>{pricingData.t('供应商')}</em>
                <strong>{vendorCount}</strong>
              </span>
              <span className='pricing-overview-inline-chip'>
                <em>{pricingData.t('分组')}</em>
                <strong>{groupCount}</strong>
              </span>
              <span className='pricing-overview-inline-chip'>
                <em>{pricingData.t('视图')}</em>
                <strong>{displayModeLabel}</strong>
              </span>
              <span className='pricing-overview-inline-chip'>
                <em>{pricingData.t('单位')}</em>
                <strong>{billingUnitLabel}</strong>
              </span>
              <span className='pricing-overview-inline-chip'>
                <em>{pricingData.t('状态')}</em>
                <strong>
                  {pricingData.loading
                    ? pricingData.t('同步中')
                    : pricingData.t('已就绪')}
                </strong>
              </span>
            </div>

            {(activeFilters.length > 0 || pricingData.searchValue) && (
              <div className='pricing-overview-filters'>
                <span className='pricing-overview-filters-label'>
                  {pricingData.t('当前筛选')}
                </span>
                {pricingData.searchValue && (
                  <span className='pricing-overview-filter-chip'>
                    <em>{pricingData.t('搜索')}</em>
                    <strong>{pricingData.searchValue}</strong>
                  </span>
                )}
                {activeFilters.map((item) => (
                  <span key={item.key} className='pricing-overview-filter-chip'>
                    <em>{item.label}</em>
                    <strong>{item.value}</strong>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Layout className='pricing-layout pricing-workbench-layout'>
        {!isMobile && (
          <Sider className='pricing-scroll-hide pricing-sidebar pricing-sidebar-column'>
            <PricingSidebar {...allProps} />
          </Sider>
        )}

        <Content className='pricing-scroll-hide pricing-content pricing-content-column'>
          <PricingContent
            {...allProps}
            isMobile={isMobile}
            sidebarProps={allProps}
          />
        </Content>
      </Layout>

      <ImagePreview
        src={pricingData.modalImageUrl}
        visible={pricingData.isModalOpenurl}
        onVisibleChange={(visible) => pricingData.setIsModalOpenurl(visible)}
      />

      <ModelDetailSideSheet
        visible={pricingData.showModelDetail}
        onClose={pricingData.closeModelDetail}
        modelData={pricingData.selectedModel}
        groupRatio={pricingData.groupRatio}
        usableGroup={pricingData.usableGroup}
        currency={pricingData.currency}
        siteDisplayType={pricingData.siteDisplayType}
        tokenUnit={pricingData.tokenUnit}
        displayPrice={pricingData.displayPrice}
        showRatio={allProps.showRatio}
        vendorsMap={pricingData.vendorsMap}
        endpointMap={pricingData.endpointMap}
        autoGroups={pricingData.autoGroups}
        t={pricingData.t}
      />
    </div>
  );
};

export default PricingPage;
