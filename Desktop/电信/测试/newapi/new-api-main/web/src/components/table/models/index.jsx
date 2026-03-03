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

import React, { useState } from 'react';
import { Banner, Button, Modal } from '@douyinfe/semi-ui';
import { IconAlertTriangle, IconClose } from '@douyinfe/semi-icons';
import CardPro from '../../common/ui/CardPro';
import ModelsTable from './ModelsTable';
import ModelsActions from './ModelsActions';
import ModelsFilters from './ModelsFilters';
import ModelsTabs from './ModelsTabs';
import EditModelModal from './modals/EditModelModal';
import EditVendorModal from './modals/EditVendorModal';
import { useModelsData } from '../../../hooks/models/useModelsData';
import { useIsMobile } from '../../../hooks/common/useIsMobile';
import { createCardProPagination } from '../../../helpers/utils';

const MARKETPLACE_DISPLAY_NOTICE_STORAGE_KEY =
  'models_marketplace_display_notice_dismissed';

const ModelsPage = () => {
  const modelsData = useModelsData();
  const isMobile = useIsMobile();

  const {
    // Edit state
    showEdit,
    editingModel,
    closeEdit,
    refresh,

    // Actions state
    selectedKeys,
    setSelectedKeys,
    setEditingModel,
    setShowEdit,
    batchDeleteModels,

    // Filters state
    formInitValues,
    setFormApi,
    searchModels,
    loading,
    searching,

    // Description state
    compactMode,
    setCompactMode,

    // Vendor state
    showAddVendor,
    setShowAddVendor,
    showEditVendor,
    setShowEditVendor,
    editingVendor,
    setEditingVendor,
    loadVendors,

    // Translation
    t,
  } = modelsData;

  const [showMarketplaceDisplayNotice, setShowMarketplaceDisplayNotice] =
    useState(() => {
      try {
        return (
          localStorage.getItem(MARKETPLACE_DISPLAY_NOTICE_STORAGE_KEY) !== '1'
        );
      } catch (_) {
        return true;
      }
    });

  const confirmCloseMarketplaceDisplayNotice = () => {
    Modal.confirm({
      title: t('确认关闭提示'),
      content: t(
        '关闭后将不再显示此提示（仅对当前浏览器生效）。确定要关闭吗？',
      ),
      okText: t('关闭提示'),
      cancelText: t('取消'),
      okButtonProps: {
        type: 'danger',
      },
      onOk: () => {
        try {
          localStorage.setItem(MARKETPLACE_DISPLAY_NOTICE_STORAGE_KEY, '1');
        } catch (_) {}
        setShowMarketplaceDisplayNotice(false);
      },
    });
  };

  return (
    <>
      <EditModelModal
        refresh={refresh}
        editingModel={editingModel}
        visiable={showEdit}
        handleClose={closeEdit}
      />

      <EditVendorModal
        visible={showAddVendor || showEditVendor}
        handleClose={() => {
          setShowAddVendor(false);
          setShowEditVendor(false);
          setEditingVendor({ id: undefined });
        }}
        editingVendor={showEditVendor ? editingVendor : { id: undefined }}
        refresh={() => {
          loadVendors();
          refresh();
        }}
      />

      {showMarketplaceDisplayNotice ? (
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <Banner
            type='warning'
            closeIcon={null}
            icon={
              <IconAlertTriangle
                size='large'
                style={{ color: 'var(--semi-color-warning)' }}
              />
            }
            description={t(
              '提示：此处配置仅用于控制「模型广场」对用户的展示效果，不会影响模型的实际调用与路由。若需配置真实调用行为，请前往「渠道管理」进行设置。',
            )}
            style={{ marginBottom: 0 }}
          />
          <Button
            theme='borderless'
            size='small'
            type='tertiary'
            icon={<IconClose aria-hidden={true} />}
            onClick={confirmCloseMarketplaceDisplayNotice}
            style={{ position: 'absolute', top: 8, right: 8 }}
            aria-label={t('关闭')}
          />
        </div>
      ) : null}
      <CardPro
        type='type3'
        tabsArea={<ModelsTabs {...modelsData} />}
        actionsArea={
          <div className='flex flex-col md:flex-row justify-between items-center gap-2 w-full'>
            <ModelsActions
              selectedKeys={selectedKeys}
              setSelectedKeys={setSelectedKeys}
              setEditingModel={setEditingModel}
              setShowEdit={setShowEdit}
              batchDeleteModels={batchDeleteModels}
              syncing={modelsData.syncing}
              syncUpstream={modelsData.syncUpstream}
              previewing={modelsData.previewing}
              previewUpstreamDiff={modelsData.previewUpstreamDiff}
              applyUpstreamOverwrite={modelsData.applyUpstreamOverwrite}
              compactMode={compactMode}
              setCompactMode={setCompactMode}
              t={t}
            />

            <div className='w-full md:w-full lg:w-auto order-1 md:order-2'>
              <ModelsFilters
                formInitValues={formInitValues}
                setFormApi={setFormApi}
                searchModels={searchModels}
                loading={loading}
                searching={searching}
                t={t}
              />
            </div>
          </div>
        }
        paginationArea={createCardProPagination({
          currentPage: modelsData.activePage,
          pageSize: modelsData.pageSize,
          total: modelsData.modelCount,
          onPageChange: modelsData.handlePageChange,
          onPageSizeChange: modelsData.handlePageSizeChange,
          isMobile: isMobile,
          t: modelsData.t,
        })}
        t={modelsData.t}
      >
        <ModelsTable {...modelsData} />
      </CardPro>
    </>
  );
};

export default ModelsPage;
