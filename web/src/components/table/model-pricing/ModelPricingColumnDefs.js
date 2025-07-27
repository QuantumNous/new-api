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

import React from 'react';
import { Tag, Space, Tooltip, Switch } from '@douyinfe/semi-ui';
import { IconVerify, IconHelpCircle } from '@douyinfe/semi-icons';
import { Popover } from '@douyinfe/semi-ui';
import { renderModelTag, stringToColor } from '../../../helpers';

function renderQuotaType(type, t) {
  switch (type) {
    case 1:
      return (
        <Tag color='teal' shape='circle'>
          {t('按次计费')}
        </Tag>
      );
    case 0:
      return (
        <Tag color='violet' shape='circle'>
          {t('按量计费')}
        </Tag>
      );
    default:
      return t('未知');
  }
}

function renderAvailable(available, t) {
  return available ? (
    <Popover
      content={
        <div style={{ padding: 8 }}>{t('您的分组可以使用该模型')}</div>
      }
      position='top'
      key={available}
      className="bg-green-50"
    >
      <IconVerify style={{ color: 'rgb(22 163 74)' }} size='large' />
    </Popover>
  ) : null;
}

function renderSupportedEndpoints(endpoints) {
  if (!endpoints || endpoints.length === 0) {
    return null;
  }
  return (
    <Space wrap>
      {endpoints.map((endpoint, idx) => (
        <Tag
          key={endpoint}
          color={stringToColor(endpoint)}
          shape='circle'
        >
          {endpoint}
        </Tag>
      ))}
    </Space>
  );
}

export const getModelPricingColumns = ({
  t,
  selectedGroup,
  usableGroup,
  groupRatio,
  copyText,
  setModalImageUrl,
  setIsModalOpenurl,
  currency,
  showWithRecharge,
  tokenUnit,
  setTokenUnit,
  displayPrice,
  handleGroupClick,
}) => {
  return [
    {
      title: t('可用性'),
      dataIndex: 'available',
      render: (text, record, index) => {
        return renderAvailable(record.enable_groups.includes(selectedGroup), t);
      },
      sorter: (a, b) => {
        const aAvailable = a.enable_groups.includes(selectedGroup);
        const bAvailable = b.enable_groups.includes(selectedGroup);
        return Number(aAvailable) - Number(bAvailable);
      },
      defaultSortOrder: 'descend',
    },
    {
      title: t('可用端点类型'),
      dataIndex: 'supported_endpoint_types',
      render: (text, record, index) => {
        return renderSupportedEndpoints(text);
      },
    },
    {
      title: t('模型名称'),
      dataIndex: 'model_name',
      render: (text, record, index) => {
        return renderModelTag(text, {
          onClick: () => {
            copyText(text);
          }
        });
      },
      onFilter: (value, record) =>
        record.model_name.toLowerCase().includes(value.toLowerCase()),
    },
    {
      title: t('计费类型'),
      dataIndex: 'quota_type',
      render: (text, record, index) => {
        return renderQuotaType(parseInt(text), t);
      },
      sorter: (a, b) => a.quota_type - b.quota_type,
    },
    {
      title: t('可用分组'),
      dataIndex: 'enable_groups',
      render: (text, record, index) => {
        return (
          <Space wrap>
            {text.map((group) => {
              if (usableGroup[group]) {
                if (group === selectedGroup) {
                  return (
                    <Tag key={group} color='blue' shape='circle' prefixIcon={<IconVerify />}>
                      {group}
                    </Tag>
                  );
                } else {
                  return (
                    <Tag
                      key={group}
                      color='blue'
                      shape='circle'
                      onClick={() => handleGroupClick(group)}
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                    >
                      {group}
                    </Tag>
                  );
                }
              }
            })}
          </Space>
        );
      },
    },
    {
      title: () => (
        <div className="flex items-center space-x-1">
          <span>{t('倍率')}</span>
          <Tooltip content={t('倍率是为了方便换算不同价格的模型')}>
            <IconHelpCircle
              className="text-blue-500 cursor-pointer"
              onClick={() => {
                setModalImageUrl('/ratio.png');
                setIsModalOpenurl(true);
              }}
            />
          </Tooltip>
        </div>
      ),
      dataIndex: 'model_ratio',
      render: (text, record, index) => {
        let content = text;
        let completionRatio = parseFloat(record.completion_ratio.toFixed(3));
        content = (
          <div className="space-y-1">
            <div className="text-gray-700">
              {t('模型倍率')}：{record.quota_type === 0 ? text : t('无')}
            </div>
            <div className="text-gray-700">
              {t('补全倍率')}：
              {record.quota_type === 0 ? completionRatio : t('无')}
            </div>
            <div className="text-gray-700">
              {t('分组倍率')}：{groupRatio[selectedGroup]}
            </div>
          </div>
        );
        return content;
      },
    },
    {
      title: (
        <div className="flex items-center space-x-2">
          <span>{t('模型价格')}</span>
          {/* 计费单位切换 */}
          <Switch
            checked={tokenUnit === 'K'}
            onChange={(checked) => setTokenUnit(checked ? 'K' : 'M')}
            checkedText="K"
            uncheckedText="M"
          />
        </div>
      ),
      dataIndex: 'model_price',
      render: (text, record, index) => {
        let content = text;
        if (record.quota_type === 0) {
          let inputRatioPriceUSD = record.model_ratio * 2 * groupRatio[selectedGroup];
          let completionRatioPriceUSD =
            record.model_ratio * record.completion_ratio * 2 * groupRatio[selectedGroup];

          const unitDivisor = tokenUnit === 'K' ? 1000 : 1;
          const unitLabel = tokenUnit === 'K' ? 'K' : 'M';

          let displayInput = displayPrice(inputRatioPriceUSD);
          let displayCompletion = displayPrice(completionRatioPriceUSD);

          const divisor = unitDivisor;
          const numInput = parseFloat(displayInput.replace(/[^0-9.]/g, '')) / divisor;
          const numCompletion = parseFloat(displayCompletion.replace(/[^0-9.]/g, '')) / divisor;

          displayInput = `${currency === 'CNY' ? '¥' : '$'}${numInput.toFixed(3)}`;
          displayCompletion = `${currency === 'CNY' ? '¥' : '$'}${numCompletion.toFixed(3)}`;
          content = (
            <div className="space-y-1">
              <div className="text-gray-700">
                {t('提示')} {displayInput} / 1{unitLabel} tokens
              </div>
              <div className="text-gray-700">
                {t('补全')} {displayCompletion} / 1{unitLabel} tokens
              </div>
            </div>
          );
        } else {
          let priceUSD = parseFloat(text) * groupRatio[selectedGroup];
          let displayVal = displayPrice(priceUSD);
          content = (
            <div className="text-gray-700">
              {t('模型价格')}：{displayVal}
            </div>
          );
        }
        return content;
      },
    },
  ];
}; 