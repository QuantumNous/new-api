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
import { Alert, Button } from '@heroui/react';
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
        // HeroUI v3 `Alert` (compound) — `status='warning'` paints the
        // amber surface tone HeroUI ships out of the box, so we don't
        // have to hand-roll bg-amber-50 / dark:bg-amber-950 etc.
        //
        // Two visual tweaks via overrides:
        //   • `!items-center` overrides `.alert`'s default `items-start`
        //     so icon + description vertically center on a single-line
        //     notice (the default top-align looks off when there's no
        //     Alert.Title).
        //   • `ct-compact-alert` shrinks description
        //     text from `text-sm` (14px) → `text-xs` (12px) for a more
        //     subdued banner that doesn't compete with the page header.
        //
        // `relative mb-3 pr-10` carves out room on the right for the
        // absolutely-positioned close affordance.
        <Alert
          status='warning'
          className='relative mb-3 pr-10 !items-center ct-compact-alert'
        >
          <Alert.Indicator>
            <TriangleAlert size={14} />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Description>
              {t(
                '提示：此处配置仅用于控制「模型广场」对用户的展示效果，不会影响模型的实际调用与路由。若需配置真实调用行为，请前往「渠道管理」进行设置。',
              )}
            </Alert.Description>
          </Alert.Content>
          <Button
            isIconOnly
            variant='ghost'
            size='sm'
            aria-label={t('关闭')}
            onPress={() => setShowCloseConfirm(true)}
            className='!absolute !right-2 !top-1/2 !-translate-y-1/2 !h-6 !w-6 !min-w-6 !rounded-md text-current/70 hover:!text-current [&_svg]:!size-3'
          >
            <X size={12} />
          </Button>
        </Alert>
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
        // ModelsActions (5 buttons) and ModelsFilters (2 inputs +
        // Query/Reset) used to share a single `flex-row` row inside
        // `actionsArea`. At medium widths neither half could fit so
        // ModelsActions wrapped to 5 vertical lines while ModelsFilters
        // floated centred at the right — visually misaligned.
        // CardPro already has separate `actionsArea` / `searchArea`
        // slots that stack vertically with their own divider, which
        // matches the layout the other admin tables use.
        actionsArea={
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
        }
        searchArea={
          <ModelsFilters
            formInitValues={formInitValues}
            setFormApi={setFormApi}
            searchModels={searchModels}
            loading={loading}
            searching={searching}
            t={t}
          />
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
