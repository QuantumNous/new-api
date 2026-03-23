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
      <div className='flex items-center gap-2 w-full'>
        <div className='flex-1'>
          <Input
            prefix={<IconSearch />}
            placeholder={t('模糊搜索模型名称')}
            value={searchValue}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            onChange={handleChange}
            showClear
          />
        </div>

        <Button
          theme='outline'
          type='primary'
          icon={<IconCopy />}
          onClick={handleCopyClick}
          disabled={selectedRowKeys.length === 0}
          className='!bg-blue-500 hover:!bg-blue-600 !text-white disabled:!bg-gray-300 disabled:!text-gray-500'
        >
          {t('复制')}
        </Button>

        {!isMobile && (
          <>
            <Divider layout='vertical' margin='8px' />

            {/* 充值价格显示开关 */}
            {supportsCurrencyDisplay && (
              <div className='flex items-center gap-2'>
                <span className='text-sm text-gray-600'>{t('充值价格显示')}</span>
                <Switch
                  checked={showWithRecharge}
                  onChange={setShowWithRecharge}
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
              />
            )}

            {/* 显示倍率开关 */}
            <div className='flex items-center gap-2'>
              <span className='text-sm text-gray-600'>{t('倍率')}</span>
              <Switch checked={showRatio} onChange={setShowRatio} />
            </div>

            {/* 视图模式切换按钮 */}
            <Button
              theme={viewMode === 'table' ? 'solid' : 'outline'}
              type={viewMode === 'table' ? 'primary' : 'tertiary'}
              onClick={handleViewModeToggle}
            >
              {t('表格视图')}
            </Button>

            {/* Token单位切换按钮 */}
            <Button
              theme={tokenUnit === 'K' ? 'solid' : 'outline'}
              type={tokenUnit === 'K' ? 'primary' : 'tertiary'}
              onClick={handleTokenUnitToggle}
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
