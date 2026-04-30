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

// /console/models vendor-filter strip — single-select pill bar that
// narrows the visible models by the upstream vendor.
//
// Mirrors the visual + interaction grammar of /console/channel's tab
// strip: HeroUI v3 `ToggleButton` (one per vendor) with React Aria's
// design-system focus ring, pressed transform, and the accent-soft
// selected state. For vendor tabs (i.e. anything except "全部"), an
// adjacent icon-only `Button` + shared `ClickMenu` exposes
// edit/delete on the vendor itself. The menu is rendered OUTSIDE the
// toggle (not nested inside) so we don't have to fight `<button>` in
// `<button>` — instead each toggle and its action menu sit side-by-
// side inside a flex pair, separated by a 1px-gap that visually reads
// as a split pill.

import React, { useState } from 'react';
import { Button, ToggleButton } from '@heroui/react';
import { Pencil, Trash2, MoreHorizontal } from 'lucide-react';
import ClickMenu from '@/components/common/ui/ClickMenu';
import ConfirmDialog from '@/components/common/ui/ConfirmDialog';
import { getLobeHubIcon, showError, showSuccess, API } from '../../../helpers';

// Count badge tucked inside each pill. Uses the toggle's selected
// foreground color (a soft accent in HeroUI) so the chip pops against
// the toggle's own selected bg without falling out of the design
// system. Unselected pills get the muted surface chip.
function CountChip({ active, count }) {
  return (
    <span
      className={`inline-flex min-w-[1.5rem] shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold ${
        active
          ? 'bg-[color:var(--toggle-button-fg-selected)]/15 text-[color:var(--toggle-button-fg-selected)]'
          : 'bg-surface-secondary text-muted'
      }`}
    >
      {count}
    </span>
  );
}

const ModelsTabs = ({
  activeVendorKey,
  setActiveVendorKey,
  vendorCounts,
  vendors,
  loadModels,
  activePage,
  pageSize,
  setActivePage,
  setShowAddVendor,
  setShowEditVendor,
  setEditingVendor,
  loadVendors,
  t,
}) => {
  const [pendingDelete, setPendingDelete] = useState(null);

  const handleTabChange = (key) => {
    setActiveVendorKey(key);
    setActivePage(1);
    loadModels(1, pageSize, key);
  };

  const handleEditVendor = (vendor) => {
    setEditingVendor(vendor);
    setShowEditVendor(true);
  };

  const handleDeleteVendor = async (vendor) => {
    try {
      const res = await API.delete(`/api/vendors/${vendor.id}`);
      if (res.data?.success) {
        showSuccess(t('供应商删除成功'));
        if (activeVendorKey === String(vendor.id)) {
          setActiveVendorKey('all');
          loadModels(1, pageSize, 'all');
        } else {
          loadModels(activePage, pageSize, activeVendorKey);
        }
        loadVendors?.();
      } else {
        showError(res.data?.message || t('删除失败'));
      }
    } catch (error) {
      showError(error.response?.data?.message || t('删除失败'));
    }
  };

  const tabs = [
    {
      key: 'all',
      label: t('全部'),
      icon: null,
      count: vendorCounts['all'] || 0,
      vendor: null,
    },
    ...vendors.map((vendor) => ({
      key: String(vendor.id),
      label: vendor.name,
      icon: getLobeHubIcon(vendor.icon || 'Layers', 14),
      count: vendorCounts[vendor.id] || 0,
      vendor,
    })),
  ];

  return (
    <>
      <div className='mb-3 flex flex-wrap items-center gap-2'>
        <div
          role='radiogroup'
          aria-label={t('供应商')}
          className='flex flex-1 flex-wrap items-center gap-2'
        >
          {tabs.map((tab) => {
            const active = activeVendorKey === tab.key;
            // Vendor tabs render a paired (toggle + menu) split-pill;
            // "全部" renders just the toggle.
            const items = tab.vendor
              ? [
                  {
                    label: t('编辑'),
                    icon: <Pencil size={14} />,
                    onClick: () => handleEditVendor(tab.vendor),
                  },
                  {
                    label: t('删除'),
                    icon: <Trash2 size={14} />,
                    danger: true,
                    onClick: () => setPendingDelete(tab.vendor),
                  },
                ]
              : null;
            return (
              <div
                key={tab.key}
                className='inline-flex items-center gap-0.5'
              >
                <ToggleButton
                  size='sm'
                  isSelected={active}
                  onChange={() => {
                    if (!active) handleTabChange(tab.key);
                  }}
                  aria-label={tab.label}
                  // ToggleButton defaults to `rounded-3xl`. When paired
                  // with an action menu we square the right edge so the
                  // two halves read as one connected split-pill.
                  className={items ? '!rounded-r-none' : ''}
                >
                  {tab.icon}
                  <span className='whitespace-nowrap'>{tab.label}</span>
                  <CountChip active={active} count={tab.count} />
                </ToggleButton>
                {items ? (
                  <ClickMenu
                    placement='bottomRight'
                    items={items}
                    trigger={
                      <Button
                        isIconOnly
                        variant='tertiary'
                        size='sm'
                        aria-label={t('操作')}
                        // Match the ToggleButton's `h-9 md:h-8` rhythm
                        // (`size='sm'`) so the two halves of the split
                        // pill sit on the same baseline; square the
                        // left edge so it joins the toggle's squared
                        // right edge.
                        className='!h-9 md:!h-8 !w-8 !min-w-8 !rounded-l-none !rounded-r-3xl !px-0 [&_svg]:!size-3.5'
                      >
                        <MoreHorizontal size={14} />
                      </Button>
                    }
                  />
                ) : null}
              </div>
            );
          })}
        </div>
        <Button
          color='primary'
          size='sm'
          onPress={() => setShowAddVendor(true)}
        >
          {t('新增供应商')}
        </Button>
      </div>

      <ConfirmDialog
        visible={!!pendingDelete}
        title={t('确认删除')}
        cancelText={t('取消')}
        confirmText={t('删除')}
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          const target = pendingDelete;
          setPendingDelete(null);
          if (target) handleDeleteVendor(target);
        }}
      >
        {t('确定要删除供应商 "{{name}}" 吗？此操作不可撤销。', {
          name: pendingDelete?.name || '',
        })}
      </ConfirmDialog>
    </>
  );
};

export default ModelsTabs;
