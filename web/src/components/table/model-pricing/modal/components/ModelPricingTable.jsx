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
import { Card, Avatar, Typography, Table, Tag } from '@douyinfe/semi-ui';
import { IconCoinMoneyStroked } from '@douyinfe/semi-icons';
import { calculateModelPrice, getDualCurrencyConfig } from '../../../../../helpers';

const { Text } = Typography;

const ModelPricingTable = ({
  modelData,
  groupRatio,
  currency,
  tokenUnit,
  displayPrice,
  showRatio,
  usableGroup,
  autoGroups = [],
  t,
}) => {
  const modelEnableGroups = Array.isArray(modelData?.enable_groups)
    ? modelData.enable_groups
    : [];
  const autoChain = autoGroups.filter((g) => modelEnableGroups.includes(g));
  const renderGroupPriceTable = () => {
    // 仅展示模型可用的分组：模型 enable_groups 与用户可用分组的交集

    const availableGroups = Object.keys(usableGroup || {})
      .filter((g) => g !== '')
      .filter((g) => g !== 'auto')
      .filter((g) => modelEnableGroups.includes(g));

    // 准备表格数据
    const { secondary } = getDualCurrencyConfig();
    const unitDivisor = tokenUnit === 'K' ? 1000 : 1;
    const formatSec = (usdPrice) => {
      if (!secondary) return '';
      const val = (usdPrice * secondary.rate) / unitDivisor;
      return ` (${secondary.symbol}${val.toFixed(4)})`;
    };
    const formatSecFixed = (usdPrice) => {
      if (!secondary) return '';
      const val = usdPrice * secondary.rate;
      return ` (${secondary.symbol}${val.toFixed(4)})`;
    };

    const tableData = availableGroups.map((group) => {
      const priceData = modelData
        ? calculateModelPrice({
            record: modelData,
            selectedGroup: group,
            groupRatio,
            tokenUnit,
            displayPrice,
            currency,
          })
        : { inputPrice: '-', outputPrice: '-', price: '-', cacheReadPrice: '-', cacheWritePrice: '-' };

      // 获取分组倍率
      const groupRatioValue =
        groupRatio && groupRatio[group] ? groupRatio[group] : 1;

      return {
        key: group,
        group: group,
        ratio: groupRatioValue,
        billingType:
          modelData?.quota_type === 0
            ? t('按量计费')
            : modelData?.quota_type === 1
              ? t('按次计费')
              : '-',
        inputPrice: modelData?.quota_type === 0 ? priceData.inputPrice : '-',
        outputPrice:
          modelData?.quota_type === 0
            ? priceData.completionPrice || priceData.outputPrice
            : '-',
        fixedPrice: modelData?.quota_type === 1 ? priceData.price : '-',
        cacheReadPrice: modelData?.quota_type === 0 ? priceData.cacheReadPrice : '-',
        cacheWritePrice: modelData?.quota_type === 0 ? priceData.cacheWritePrice : '-',
        // raw USD prices for dual currency
        _priceData: priceData,
      };
    });

    // 定义表格列
    const columns = [
      {
        title: t('分组'),
        dataIndex: 'group',
        render: (text) => (
          <Tag color='white' size='small' shape='circle'>
            {text}
            {t('分组')}
          </Tag>
        ),
      },
    ];

    // 如果显示倍率，添加倍率列
    if (showRatio) {
      columns.push({
        title: t('倍率'),
        dataIndex: 'ratio',
        render: (text) => (
          <Tag color='white' size='small' shape='circle'>
            {text}x
          </Tag>
        ),
      });
    }

    // 添加计费类型列
    columns.push({
      title: t('计费类型'),
      dataIndex: 'billingType',
      render: (text) => {
        let color = 'white';
        if (text === t('按量计费')) color = 'violet';
        else if (text === t('按次计费')) color = 'teal';
        return (
          <Tag color={color} size='small' shape='circle'>
            {text || '-'}
          </Tag>
        );
      },
    });

    // 根据计费类型添加价格列
    if (modelData?.quota_type === 0) {
      // 按量计费 - 输入/输出/缓存读取/缓存写入合并为"计费"列
      const tokenUnitLabel = tokenUnit === 'K' ? '1K' : '1M';
      columns.push({
        title: t('计费'),
        dataIndex: 'inputPrice',
        render: (text, record) => {
          const pd = record._priceData;
          return (
            <div className='space-y-1'>
              <div>
                <span className='text-xs text-gray-500'>{t('提示')}：</span>
                <span className='font-semibold text-orange-600'>
                  {text}{pd?.inputPriceUSD !== undefined ? formatSec(pd.inputPriceUSD) : ''}
                </span>
                <span className='text-xs text-gray-500'> / {tokenUnitLabel} tokens</span>
              </div>
              <div>
                <span className='text-xs text-gray-500'>{t('补全')}：</span>
                <span className='font-semibold text-orange-600'>
                  {record.outputPrice}{pd?.completionPriceUSD !== undefined ? formatSec(pd.completionPriceUSD) : ''}
                </span>
                <span className='text-xs text-gray-500'> / {tokenUnitLabel} tokens</span>
              </div>
              <div>
                <span className='text-xs text-gray-500'>{t('缓存读取')}：</span>
                <span className='font-semibold text-orange-600'>
                  {record.cacheReadPrice}{pd?.cacheReadPriceUSD !== undefined ? formatSec(pd.cacheReadPriceUSD) : ''}
                </span>
                <span className='text-xs text-gray-500'> / {tokenUnitLabel} tokens</span>
              </div>
              <div>
                <span className='text-xs text-gray-500'>{t('缓存写入')}：</span>
                <span className='font-semibold text-orange-600'>
                  {record.cacheWritePrice}{pd?.cacheWritePriceUSD !== undefined ? formatSec(pd.cacheWritePriceUSD) : ''}
                </span>
                <span className='text-xs text-gray-500'> / {tokenUnitLabel} tokens</span>
              </div>
            </div>
          );
        },
      });
    } else {
      // 按次计费
      columns.push({
        title: t('价格'),
        dataIndex: 'fixedPrice',
        render: (text, record) => {
          const pd = record._priceData;
          return (
            <>
              <div className='font-semibold text-orange-600'>
                {text}{pd?.priceUSD !== undefined ? formatSecFixed(pd.priceUSD) : ''}
              </div>
              <div className='text-xs text-gray-500'>/ 次</div>
            </>
          );
        },
      });
    }

    return (
      <Table
        dataSource={tableData}
        columns={columns}
        pagination={false}
        size='small'
        bordered={false}
        className='!rounded-lg'
      />
    );
  };

  return (
    <Card className='!rounded-2xl shadow-sm border-0'>
      <div className='flex items-center mb-4'>
        <Avatar size='small' color='orange' className='mr-2 shadow-md'>
          <IconCoinMoneyStroked size={16} />
        </Avatar>
        <div>
          <Text className='text-lg font-medium'>{t('分组价格')}</Text>
          <div className='text-xs text-gray-600'>
            {t('不同用户分组的价格信息')}
          </div>
        </div>
      </div>
      {autoChain.length > 0 && (
        <div className='flex flex-wrap items-center gap-1 mb-4'>
          <span className='text-sm text-gray-600'>{t('auto分组调用链路')}</span>
          <span className='text-sm'>→</span>
          {autoChain.map((g, idx) => (
            <React.Fragment key={g}>
              <Tag color='white' size='small' shape='circle'>
                {g}
                {t('分组')}
              </Tag>
              {idx < autoChain.length - 1 && <span className='text-sm'>→</span>}
            </React.Fragment>
          ))}
        </div>
      )}
      {renderGroupPriceTable()}
    </Card>
  );
};

export default ModelPricingTable;
