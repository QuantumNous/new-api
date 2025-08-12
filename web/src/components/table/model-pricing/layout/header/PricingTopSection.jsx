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

import React, { useMemo, useState } from 'react';
import { Input, Button } from '@douyinfe/semi-ui';
import { IconSearch, IconCopy, IconFilter } from '@douyinfe/semi-icons';
import PricingFilterModal from '../../modal/PricingFilterModal';
import PricingVendorIntroWithSkeleton from './PricingVendorIntroWithSkeleton';

const PricingTopSection = ({
  selectedRowKeys,
  copyText,
  handleChange,
  handleCompositionStart,
  handleCompositionEnd,
  isMobile,
  sidebarProps,
  filterVendor,
  models,
  filteredModels,
  loading,
  t
}) => {
  const [showFilterModal, setShowFilterModal] = useState(false);

  const SearchAndActions = useMemo(() => (
    <div className="flex items-center gap-4 w-full">
      {/* 搜索框 */}
      <div className="flex-1">
        <Input
          prefix={<IconSearch />}
          placeholder={t('模糊搜索模型名称')}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          onChange={handleChange}
          showClear
          style={{ backgroundColor: 'transparent' }}
        />
      </div>

      {/* 操作按钮 */}
      <Button
        theme='outline'
        type='primary'
        icon={<IconCopy />}
        onClick={() => copyText(selectedRowKeys)}
        disabled={selectedRowKeys.length === 0}
        className="!bg-blue-500 hover:!bg-blue-600 text-white"
      >
        {t('复制')}
      </Button>

      {/* 移动端筛选按钮 */}
      {isMobile && (
        <Button
          theme="outline"
          type='tertiary'
          icon={<IconFilter />}
          onClick={() => setShowFilterModal(true)}
        >
          {t('筛选')}
        </Button>
      )}
    </div>
  ), [selectedRowKeys, t, handleCompositionStart, handleCompositionEnd, handleChange, copyText, isMobile]);

  return (
    <>
      {/* 供应商介绍区域（桌面端显示） */}
      {!isMobile && (
        <PricingVendorIntroWithSkeleton
          loading={loading}
          filterVendor={filterVendor}
          models={filteredModels}
          allModels={models}
          t={t}
        />
      )}

      {/* 搜索和操作区域 */}
      {SearchAndActions}

      {/* 移动端筛选Modal */}
      {isMobile && (
        <PricingFilterModal
          visible={showFilterModal}
          onClose={() => setShowFilterModal(false)}
          sidebarProps={sidebarProps}
          t={t}
        />
      )}
    </>
  );
};

export default PricingTopSection; 