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

import React, { useMemo } from 'react';
import { Card, Input, Button, Space, Switch, Select } from '@douyinfe/semi-ui';
import { IconSearch, IconCopy } from '@douyinfe/semi-icons';

const ModelPricingFilters = ({
  selectedRowKeys,
  copyText,
  showWithRecharge,
  setShowWithRecharge,
  currency,
  setCurrency,
  handleChange,
  handleCompositionStart,
  handleCompositionEnd,
  t
}) => {
  const SearchAndActions = useMemo(() => (
    <Card className="!rounded-xl mb-6" bordered={false}>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px]">
          <Input
            prefix={<IconSearch />}
            placeholder={t('模糊搜索模型名称')}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            onChange={handleChange}
            showClear
          />
        </div>
        <Button
          theme='light'
          type='primary'
          icon={<IconCopy />}
          onClick={() => copyText(selectedRowKeys)}
          disabled={selectedRowKeys.length === 0}
          className="!bg-blue-500 hover:!bg-blue-600 text-white"
        >
          {t('复制选中模型')}
        </Button>

        {/* 充值价格显示开关 */}
        <Space align="center">
          <span>{t('以充值价格显示')}</span>
          <Switch
            checked={showWithRecharge}
            onChange={setShowWithRecharge}
            size="small"
          />
          {showWithRecharge && (
            <Select
              value={currency}
              onChange={setCurrency}
              size="small"
              style={{ width: 100 }}
            >
              <Select.Option value="USD">USD ($)</Select.Option>
              <Select.Option value="CNY">CNY (¥)</Select.Option>
            </Select>
          )}
        </Space>
      </div>
    </Card>
  ), [selectedRowKeys, t, showWithRecharge, currency, handleCompositionStart, handleCompositionEnd, handleChange, copyText, setShowWithRecharge, setCurrency]);

  return SearchAndActions;
};

export default ModelPricingFilters; 