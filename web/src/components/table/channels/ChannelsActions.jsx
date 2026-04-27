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
import { Button, Switch } from '@heroui/react';
import { ChevronDown } from 'lucide-react';
import CompactModeToggle from '../../common/ui/CompactModeToggle';
import ConfirmDialog from '@/components/common/ui/ConfirmDialog';

function ToggleSwitch({ value, onChange }) {
  return (
    <Switch
      isSelected={!!value}
      onChange={onChange}
      size='sm'
      aria-label='toggle'
    >
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
    </Switch>
  );
}

function ClickDropdown({ label, items }) {
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
    <span ref={ref} className='relative inline-flex w-full md:w-auto'>
      <Button
        variant='flat'
        size='sm'
        className='w-full md:w-auto'
        endContent={<ChevronDown size={14} />}
        onPress={() => setOpen((prev) => !prev)}
      >
        {label}
      </Button>
      {open ? (
        <div
          role='menu'
          className='absolute left-0 top-full z-30 mt-1 min-w-[14rem] overflow-hidden rounded-lg border border-[color:var(--app-border)] bg-background shadow-lg'
        >
          {items.map((item, idx) => (
            <button
              key={idx}
              type='button'
              role='menuitem'
              disabled={item.disabled}
              className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
                item.danger
                  ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40'
                  : 'text-foreground hover:bg-[color:var(--app-background)]'
              }`}
              onClick={() => {
                setOpen(false);
                item.onClick?.();
              }}
            >
              <span>{item.label}</span>
              {item.pending ? (
                <span className='h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent' />
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </span>
  );
}

const ChannelsActions = ({
  enableBatchDelete,
  batchDeleteChannels,
  setShowBatchSetTag,
  testAllChannels,
  fixChannelsAbilities,
  updateAllChannelsBalance,
  deleteAllDisabledChannels,
  applyAllUpstreamUpdates,
  detectAllUpstreamUpdates,
  detectAllUpstreamUpdatesLoading,
  applyAllUpstreamUpdatesLoading,
  compactMode,
  setCompactMode,
  idSort,
  setIdSort,
  setEnableBatchDelete,
  enableTagMode,
  setEnableTagMode,
  statusFilter,
  setStatusFilter,
  getFormValues,
  loadChannels,
  searchChannels,
  activeTypeKey,
  activePage,
  pageSize,
  setActivePage,
  t,
}) => {
  const [confirm, setConfirm] = useState(null);

  const ask = (config) => setConfirm(config);

  const dropdownItems = [
    {
      label: t('测试所有未手动禁用渠道'),
      pending: detectAllUpstreamUpdatesLoading,
      disabled: detectAllUpstreamUpdatesLoading,
      onClick: () =>
        ask({
          title: t('确定？'),
          content: t('确定要测试所有未手动禁用渠道吗？'),
          onConfirm: testAllChannels,
        }),
    },
    {
      label: t('修复数据库一致性'),
      onClick: () =>
        ask({
          title: t('确定是否要修复数据库一致性？'),
          content: t('进行该操作时，可能导致渠道访问错误，请仅在数据库出现问题时使用'),
          onConfirm: fixChannelsAbilities,
        }),
    },
    {
      label: t('更新所有已启用通道余额'),
      onClick: () =>
        ask({
          title: t('确定？'),
          content: t('确定要更新所有已启用通道余额吗？'),
          onConfirm: updateAllChannelsBalance,
        }),
    },
    {
      label: t('检测全部渠道上游更新'),
      onClick: () =>
        ask({
          title: t('确定？'),
          content: t('确定要仅检测全部渠道上游模型更新吗？（不执行新增/删除）'),
          onConfirm: detectAllUpstreamUpdates,
        }),
    },
    {
      label: t('处理全部渠道上游更新'),
      pending: applyAllUpstreamUpdatesLoading,
      disabled: applyAllUpstreamUpdatesLoading,
      onClick: () =>
        ask({
          title: t('确定？'),
          content: t('确定要对全部渠道执行上游模型更新吗？'),
          onConfirm: applyAllUpstreamUpdates,
        }),
    },
    {
      label: t('删除禁用通道'),
      danger: true,
      onClick: () =>
        ask({
          title: t('确定是否要删除禁用通道？'),
          content: t('此修改将不可逆'),
          onConfirm: deleteAllDisabledChannels,
          danger: true,
        }),
    },
  ];

  return (
    <div className='flex flex-col gap-2'>
      <div className='flex flex-col justify-between gap-2 md:flex-row'>
        <div className='order-2 flex w-full flex-wrap items-center gap-2 md:order-1 md:w-auto md:flex-nowrap'>
          <Button
            size='sm'
            color='danger'
            isDisabled={!enableBatchDelete}
            className='w-full md:w-auto'
            onPress={() =>
              ask({
                title: t('确定是否要删除所选通道？'),
                content: t('此修改将不可逆'),
                onConfirm: batchDeleteChannels,
                danger: true,
              })
            }
          >
            {t('删除所选通道')}
          </Button>

          <Button
            size='sm'
            variant='flat'
            isDisabled={!enableBatchDelete}
            className='w-full md:w-auto'
            onPress={() => setShowBatchSetTag(true)}
          >
            {t('批量设置标签')}
          </Button>

          <ClickDropdown label={t('批量操作')} items={dropdownItems} />

          <CompactModeToggle
            compactMode={compactMode}
            setCompactMode={setCompactMode}
            t={t}
          />
        </div>

        <div className='order-1 flex w-full flex-col items-start gap-2 md:order-2 md:w-auto md:flex-row md:items-center'>
          <div className='flex w-full items-center justify-between md:w-auto'>
            <span className='mr-2 text-sm font-semibold text-foreground'>
              {t('使用ID排序')}
            </span>
            <ToggleSwitch
              value={idSort}
              onChange={(v) => {
                localStorage.setItem('id-sort', v + '');
                setIdSort(v);
                const { searchKeyword, searchGroup, searchModel } =
                  getFormValues();
                if (
                  searchKeyword === '' &&
                  searchGroup === '' &&
                  searchModel === ''
                ) {
                  loadChannels(activePage, pageSize, v, enableTagMode);
                } else {
                  searchChannels(
                    enableTagMode,
                    activeTypeKey,
                    statusFilter,
                    activePage,
                    pageSize,
                    v,
                  );
                }
              }}
            />
          </div>

          <div className='flex w-full items-center justify-between md:w-auto'>
            <span className='mr-2 text-sm font-semibold text-foreground'>
              {t('开启批量操作')}
            </span>
            <ToggleSwitch
              value={enableBatchDelete}
              onChange={(v) => {
                localStorage.setItem('enable-batch-delete', v + '');
                setEnableBatchDelete(v);
              }}
            />
          </div>

          <div className='flex w-full items-center justify-between md:w-auto'>
            <span className='mr-2 text-sm font-semibold text-foreground'>
              {t('标签聚合模式')}
            </span>
            <ToggleSwitch
              value={enableTagMode}
              onChange={(v) => {
                localStorage.setItem('enable-tag-mode', v + '');
                setEnableTagMode(v);
                setActivePage(1);
                loadChannels(1, pageSize, idSort, v);
              }}
            />
          </div>

          <div className='flex w-full items-center justify-between md:w-auto'>
            <span className='mr-2 text-sm font-semibold text-foreground'>
              {t('状态筛选')}
            </span>
            <select
              className='h-8 rounded-lg border border-[color:var(--app-border)] bg-background px-2 text-sm text-foreground outline-none transition focus:border-primary'
              value={statusFilter}
              onChange={(event) => {
                const v = event.target.value;
                localStorage.setItem('channel-status-filter', v);
                setStatusFilter(v);
                setActivePage(1);
                loadChannels(
                  1,
                  pageSize,
                  idSort,
                  enableTagMode,
                  activeTypeKey,
                  v,
                );
              }}
            >
              <option value='all'>{t('全部')}</option>
              <option value='enabled'>{t('已启用')}</option>
              <option value='disabled'>{t('已禁用')}</option>
            </select>
          </div>
        </div>
      </div>

      <ConfirmDialog
        visible={!!confirm}
        title={confirm?.title || ''}
        cancelText={t('取消')}
        confirmText={t('确定')}
        danger={!!confirm?.danger}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const action = confirm?.onConfirm;
          setConfirm(null);
          action?.();
        }}
      >
        {confirm?.content}
      </ConfirmDialog>
    </div>
  );
};

export default ChannelsActions;
