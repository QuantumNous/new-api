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
import { Button } from '@heroui/react';
import { TriangleAlert, X } from 'lucide-react';
import CardPro from '../../common/ui/CardPro';
import ConfirmDialog from '@/components/common/ui/ConfirmDialog';
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
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const dismissMarketplaceDisplayNotice = () => {
    try {
      localStorage.setItem(MARKETPLACE_DISPLAY_NOTICE_STORAGE_KEY, '1');
    } catch (_) {}
    setShowMarketplaceDisplayNotice(false);
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
        <div className='relative mb-3 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 pr-12 text-sm text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100'>
          <TriangleAlert size={18} className='mt-0.5 shrink-0' />
          <div className='min-w-0 flex-1'>
            {t(
              '提示：此处配置仅用于控制「模型广场」对用户的展示效果，不会影响模型的实际调用与路由。若需配置真实调用行为，请前往「渠道管理」进行设置。',
            )}
          </div>
          <button
            type='button'
            onClick={() => setShowCloseConfirm(true)}
            aria-label={t('关闭')}
            className='absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-md text-amber-700/70 transition hover:bg-amber-100 hover:text-amber-700 dark:text-amber-100/70 dark:hover:bg-amber-900/50 dark:hover:text-amber-100'
          >
            <X size={14} />
          </button>
        </div>
      ) : null}

      <ConfirmDialog
        visible={showCloseConfirm}
        title={t('确认关闭提示')}
        cancelText={t('取消')}
        confirmText={t('关闭提示')}
        danger
        onCancel={() => setShowCloseConfirm(false)}
        onConfirm={() => {
          setShowCloseConfirm(false);
          dismissMarketplaceDisplayNotice();
        }}
      >
        {t('关闭后将不再显示此提示（仅对当前浏览器生效）。确定要关闭吗？')}
      </ConfirmDialog>
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
