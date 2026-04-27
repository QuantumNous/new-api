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

import React, { memo, useCallback } from 'react';
import { Button, Input, ListBox, Separator, Switch } from '@heroui/react';
import { InlineSelect, Segment } from '@heroui-pro/react';
import {
  ChevronsUpDown,
  Copy,
  Filter,
  LayoutGrid,
  Search,
  Table,
} from 'lucide-react';

const SearchActions = memo(
  ({
    selectedRowKeys = [],
    copyText,
    handleChange,
    handleCompositionStart,
    handleCompositionEnd,
    isMobile = false,
    searchValue = '',
    setShowFilterModal,
    showWithRecharge,
    setShowWithRecharge,
    currency,
    setCurrency,
    siteDisplayType,
    showRatio,
    setShowRatio,
    viewMode,
    setViewMode,
    tokenUnit,
    setTokenUnit,
    t,
  }) => {
    const supportsCurrencyDisplay = siteDisplayType !== 'TOKENS';

    const handleCopyClick = useCallback(() => {
      if (copyText && selectedRowKeys.length > 0) {
        copyText(selectedRowKeys);
      }
    }, [copyText, selectedRowKeys]);

    const handleFilterClick = useCallback(() => {
      setShowFilterModal?.(true);
    }, [setShowFilterModal]);

    return (
      <div className='flex items-center gap-2 w-full'>
        <div className='relative flex-1'>
          <Search
            size={16}
            className='pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted'
          />
          <Input
            placeholder={t('模糊搜索模型名称')}
            value={searchValue}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            onChange={(event) => handleChange?.(event)}
            className='pl-9'
          />
        </div>

        <Button
          variant='primary'
          onPress={handleCopyClick}
          isDisabled={selectedRowKeys.length === 0}
        >
          <Copy size={16} />
          {t('复制')}
        </Button>

        {!isMobile && (
          <>
            <Separator orientation='vertical' className='h-8' />

            {/* 充值价格显示开关 */}
            {supportsCurrencyDisplay && (
              <div className='flex items-center gap-2'>
                <span className='text-sm text-muted'>{t('充值价格显示')}</span>
                <Switch
                  isSelected={showWithRecharge}
                  onChange={setShowWithRecharge}
                  aria-label={t('充值价格显示')}
                >
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
              </div>
            )}

            {/* 货币单位选择 — heroui-pro InlineSelect 是为这种与周边
                控件并排的紧凑场景设计的（ghost 样式、内联），比原来的
                原生 <select> 更贴合设计系统。 */}
            {supportsCurrencyDisplay && showWithRecharge && (
              <InlineSelect
                aria-label={t('货币')}
                selectedKey={currency}
                onSelectionChange={(key) => {
                  if (key) setCurrency?.(String(key));
                }}
              >
                <InlineSelect.Trigger>
                  <InlineSelect.Value />
                  {/* Default indicator falls back to a @gravity-ui icon
                      that breaks under our Vite + esbuild `loader:'jsx'`
                      CJS interop (resolves to the full module.exports
                      object instead of .default). Passing an explicit
                      lucide icon both fixes the crash and stays consistent
                      with the rest of the app's iconography. */}
                  <InlineSelect.Indicator>
                    <ChevronsUpDown size={12} />
                  </InlineSelect.Indicator>
                </InlineSelect.Trigger>
                <InlineSelect.Popover className='min-w-[140px]'>
                  <ListBox>
                    <ListBox.Item id='USD' textValue='USD'>
                      USD
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                    <ListBox.Item id='CNY' textValue='CNY'>
                      CNY
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                    <ListBox.Item id='CUSTOM' textValue={t('自定义货币')}>
                      {t('自定义货币')}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  </ListBox>
                </InlineSelect.Popover>
              </InlineSelect>
            )}

            {/* 显示倍率开关 */}
            <div className='flex items-center gap-2'>
              <span className='text-sm text-muted'>{t('倍率')}</span>
              <Switch
                isSelected={showRatio}
                onChange={setShowRatio}
                aria-label={t('倍率')}
              >
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch>
            </div>

            {/* 视图模式 — Segment 取代了原来"两个 Button 互相切换"
                的写法，UX 更直观（哪个被选中一目了然，且两个状态在
                视觉上是平等的，没有"哪个高亮就是当前"这种二义性）。 */}
            <Segment
              size='sm'
              aria-label={t('视图模式')}
              selectedKey={viewMode}
              onSelectionChange={(key) => {
                if (key) setViewMode?.(String(key));
              }}
            >
              <Segment.Item id='card' aria-label={t('卡片视图')}>
                <Segment.Separator />
                <LayoutGrid size={14} />
              </Segment.Item>
              <Segment.Item id='table' aria-label={t('表格视图')}>
                <Segment.Separator />
                <Table size={14} />
              </Segment.Item>
            </Segment>

            {/* Token 单位（每千 / 每百万）— 同样用 Segment 表达
                两个互斥选项。 */}
            <Segment
              size='sm'
              aria-label={t('Token 单位')}
              selectedKey={tokenUnit}
              onSelectionChange={(key) => {
                if (key) setTokenUnit?.(String(key));
              }}
            >
              <Segment.Item id='K'>
                <Segment.Separator />
                /1K
              </Segment.Item>
              <Segment.Item id='M'>
                <Segment.Separator />
                /1M
              </Segment.Item>
            </Segment>
          </>
        )}

        {isMobile && (
          <Button variant='outline' onPress={handleFilterClick}>
            <Filter size={16} />
            {t('筛选')}
          </Button>
        )}
      </div>
    );
  },
);

SearchActions.displayName = 'SearchActions';

export default SearchActions;
