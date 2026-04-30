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
import { Button, ListBox, Select, Spinner, Switch } from '@heroui/react';
import { ChevronDown } from 'lucide-react';
import CompactModeToggle from '../../common/ui/CompactModeToggle';
import ConfirmDialog from '@/components/common/ui/ConfirmDialog';
import ClickMenu from '@/components/common/ui/ClickMenu';

// Compact inline status filter — HeroUI v3 `Select` sized to match the
// 32px row of the toggle switches sitting next to it. We trade the
// native `<select>` for the HeroUI compound surface so the popover
// chrome (border, shadow, item highlight) lines up with the rest of
// the console (e.g. /console/log filter dropdowns, the page-size picker).
function StatusFilterSelect({ value, onChange, options, ariaLabel }) {
  return (
    <Select
      aria-label={ariaLabel}
      selectedKey={value}
      onSelectionChange={(key) => {
        if (key == null) return;
        onChange(String(key));
      }}
      className='w-32'
    >
      <Select.Trigger className='!min-h-8 h-8 rounded-lg border border-[color:var(--app-border)] bg-background px-2 text-sm text-foreground outline-none transition focus:border-primary flex items-center justify-between gap-1 cursor-pointer text-left'>
        <Select.Value className='truncate' />
        <Select.Indicator>
          <ChevronDown size={12} className='text-muted shrink-0' />
        </Select.Indicator>
      </Select.Trigger>
      <Select.Popover className='min-w-(--trigger-width)'>
        <ListBox>
          {options.map((opt) => (
            <ListBox.Item key={opt.value} id={opt.value} textValue={opt.label}>
              {opt.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

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
          content: t(
            '进行该操作时，可能导致渠道访问错误，请仅在数据库出现问题时使用',
          ),
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
            variant='danger-soft'
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
            variant='tertiary'
            isDisabled={!enableBatchDelete}
            className='w-full md:w-auto'
            onPress={() => setShowBatchSetTag(true)}
          >
            {t('批量设置标签')}
          </Button>

          {/* Bulk-ops menu: the shared ClickMenu (popover-positioned, click
              outside to dismiss) so the open / item-hover / divider chrome
              matches the rest of the console (token row "..." menu, channel
              "更多操作" cell). The trigger is a plain HeroUI Button — no more
              hand-rolled positioning, click-outside listener, or pending
              spinner glyph. */}
          <ClickMenu
            placement='bottomLeft'
            menuClassName='!min-w-[14rem]'
            items={dropdownItems.map((item) => ({
              ...item,
              suffix: item.pending ? (
                <Spinner size='sm' className='!size-3' />
              ) : undefined,
            }))}
            trigger={
              <Button
                variant='tertiary'
                size='sm'
                className='w-full md:w-auto'
              >
                {t('批量操作')}
                <ChevronDown size={14} />
              </Button>
            }
          />

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
            <StatusFilterSelect
              ariaLabel={t('状态筛选')}
              value={statusFilter}
              options={[
                { value: 'all', label: t('全部') },
                { value: 'enabled', label: t('已启用') },
                { value: 'disabled', label: t('已禁用') },
              ]}
              onChange={(v) => {
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
            />
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
