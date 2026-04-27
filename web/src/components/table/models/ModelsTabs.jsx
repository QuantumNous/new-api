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

import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@heroui/react';
import { Pencil, Trash2, MoreHorizontal } from 'lucide-react';
import { getLobeHubIcon, showError, showSuccess, API } from '../../../helpers';
import ConfirmDialog from '@/components/common/ui/ConfirmDialog';

function CountChip({ active, count }) {
  return (
    <span
      className={`inline-flex min-w-[1.5rem] shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold ${
        active
          ? 'bg-red-500 text-white'
          : 'bg-surface-secondary text-muted'
      }`}
    >
      {count}
    </span>
  );
}

function VendorActions({ vendor, onEdit, onDelete, t }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <span ref={ref} className='relative inline-flex items-center'>
      <button
        type='button'
        aria-label={t('操作')}
        title={t('操作')}
        className='inline-flex h-6 w-6 items-center justify-center rounded-md text-muted transition hover:bg-[color:var(--app-background)] hover:text-foreground'
        onClick={(event) => {
          event.stopPropagation();
          setOpen((prev) => !prev);
        }}
      >
        <MoreHorizontal size={14} />
      </button>
      {open ? (
        <div
          role='menu'
          className='absolute right-0 top-full z-30 mt-1 min-w-[8rem] overflow-hidden rounded-lg border border-[color:var(--app-border)] bg-background shadow-lg'
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type='button'
            role='menuitem'
            className='flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground transition hover:bg-[color:var(--app-background)]'
            onClick={(event) => {
              event.stopPropagation();
              setOpen(false);
              onEdit(vendor);
            }}
          >
            <Pencil size={14} />
            {t('编辑')}
          </button>
          <button
            type='button'
            role='menuitem'
            className='flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40'
            onClick={(event) => {
              event.stopPropagation();
              setOpen(false);
              onDelete(vendor);
            }}
          >
            <Trash2 size={14} />
            {t('删除')}
          </button>
        </div>
      ) : null}
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
        <div role='tablist' className='flex flex-1 flex-wrap items-center gap-2'>
          {tabs.map((tab) => {
            const active = activeVendorKey === tab.key;
            return (
              <div
                key={tab.key}
                role='tab'
                aria-selected={active}
                className={`group inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                  active
                    ? 'border-transparent bg-foreground text-background shadow-sm'
                    : 'border-[color:var(--app-border)] bg-[color:var(--app-background)] text-foreground hover:bg-surface-secondary'
                }`}
              >
                <button
                  type='button'
                  className='inline-flex items-center gap-2 outline-none'
                  onClick={() => handleTabChange(tab.key)}
                >
                  {tab.icon}
                  <span className='whitespace-nowrap'>{tab.label}</span>
                  <CountChip active={active} count={tab.count} />
                </button>
                {tab.vendor ? (
                  <VendorActions
                    vendor={tab.vendor}
                    onEdit={handleEditVendor}
                    onDelete={(vendor) => setPendingDelete(vendor)}
                    t={t}
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
