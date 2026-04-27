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
import { Button, Input, Separator, Switch } from '@heroui/react';
import { Copy, Filter, Search } from 'lucide-react';

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

    const handleViewModeToggle = useCallback(() => {
      setViewMode?.(viewMode === 'table' ? 'card' : 'table');
    }, [viewMode, setViewMode]);

    const handleTokenUnitToggle = useCallback(() => {
      setTokenUnit?.(tokenUnit === 'K' ? 'M' : 'K');
    }, [tokenUnit, setTokenUnit]);

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

            {/* 货币单位选择 */}
            {supportsCurrencyDisplay && showWithRecharge && (
              <select
                value={currency}
                onChange={(event) => setCurrency?.(event.target.value)}
                className='h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none transition focus:border-accent'
              >
                <option value='USD'>USD</option>
                <option value='CNY'>CNY</option>
                <option value='CUSTOM'>{t('自定义货币')}</option>
              </select>
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

            {/* 视图模式切换按钮 */}
            <Button
              variant={viewMode === 'table' ? 'primary' : 'outline'}
              onPress={handleViewModeToggle}
            >
              {t('表格视图')}
            </Button>

            {/* Token单位切换按钮 */}
            <Button
              variant={tokenUnit === 'K' ? 'primary' : 'outline'}
              onPress={handleTokenUnitToggle}
            >
              {tokenUnit}
            </Button>
          </>
        )}

        {isMobile && (
          <Button
            variant='outline'
            onPress={handleFilterClick}
          >
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
