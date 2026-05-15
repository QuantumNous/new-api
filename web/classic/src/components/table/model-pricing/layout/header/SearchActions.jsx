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
import { Input, Button, Switch, Select, Divider } from '@douyinfe/semi-ui';
import { IconSearch, IconCopy, IconFilter } from '@douyinfe/semi-icons';

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
      <div className='pricing-actions-bar flex items-center gap-2 w-full'>
        <div className='pricing-actions-search flex-1'>
          <Input
            prefix={<IconSearch />}
            placeholder={t('模糊搜索模型名称')}
            size='large'
            value={searchValue}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            onChange={handleChange}
            showClear
            className='pricing-search-control'
          />
        </div>

        <Button
          theme='outline'
          type='primary'
          icon={<IconCopy />}
          onClick={handleCopyClick}
          disabled={selectedRowKeys.length === 0}
          className='pricing-toolbar-button pricing-toolbar-button-primary'
        >
          {t('复制')}
        </Button>

        {!isMobile && (
          <>
            <Divider
              layout='vertical'
              margin='8px'
              className='pricing-actions-divider'
            />

            {/* 充值价格显示开关 */}
            {supportsCurrencyDisplay && (
              <div className='pricing-toggle-chip flex items-center gap-2'>
                <span className='pricing-toggle-label text-sm text-gray-600'>
                  {t('充值价格显示')}
                </span>
                <Switch
                  checked={showWithRecharge}
                  onChange={setShowWithRecharge}
                  className='pricing-toolbar-switch'
                />
              </div>
            )}

            {/* 货币单位选择 */}
            {supportsCurrencyDisplay && showWithRecharge && (
              <Select
                value={currency}
                onChange={setCurrency}
                optionList={[
                  { value: 'USD', label: 'USD' },
                  { value: 'CNY', label: 'CNY' },
                  { value: 'CUSTOM', label: t('自定义货币') },
                ]}
                className='pricing-currency-select'
              />
            )}

            {/* 显示倍率开关 */}
            <div className='pricing-toggle-chip flex items-center gap-2'>
              <span className='pricing-toggle-label text-sm text-gray-600'>
                {t('倍率')}
              </span>
              <Switch
                checked={showRatio}
                onChange={setShowRatio}
                className='pricing-toolbar-switch'
              />
            </div>

            {/* 视图模式切换按钮 */}
            <Button
              theme={viewMode === 'table' ? 'solid' : 'outline'}
              type={viewMode === 'table' ? 'primary' : 'tertiary'}
              onClick={handleViewModeToggle}
              className={`pricing-toolbar-button ${viewMode === 'table' ? 'pricing-toolbar-button-primary' : ''}`}
            >
              {t('表格视图')}
            </Button>

            {/* Token单位切换按钮 */}
            <Button
              theme={tokenUnit === 'K' ? 'solid' : 'outline'}
              type={tokenUnit === 'K' ? 'primary' : 'tertiary'}
              onClick={handleTokenUnitToggle}
              className={`pricing-toolbar-button ${tokenUnit === 'K' ? 'pricing-toolbar-button-primary' : ''}`}
            >
              {tokenUnit}
            </Button>
          </>
        )}

        {isMobile && (
          <Button
            theme='outline'
            type='tertiary'
            icon={<IconFilter />}
            onClick={handleFilterClick}
            className='pricing-toolbar-button pricing-filter-trigger'
          >
            {t('筛选')}
          </Button>
        )}
      </div>
    );
  },
);

SearchActions.displayName = 'SearchActions';

export default SearchActions;
