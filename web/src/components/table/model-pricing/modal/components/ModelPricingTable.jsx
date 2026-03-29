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
import { calculateModelPrice, getModelPriceItems } from '../../../../../helpers';

const { Text } = Typography;

const ModelPricingTable = ({
  modelData,
  groupRatio,
  currency,
  siteDisplayType,
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

  const modelPriceBySeconds =
    modelData?.model_price_by_seconds &&
    typeof modelData.model_price_by_seconds === 'object'
      ? modelData.model_price_by_seconds
      : {};

  const autoChain = autoGroups.filter((g) => modelEnableGroups.includes(g));

  const getBillingTypeLabel = (quotaType) => {
    if (quotaType === 0) return t('按量计费');
    if (quotaType === 1) return t('按次计费');
    if (quotaType === 2) return t('按时长计费');
    return '-';
  };

  const getBillingTypeColor = (quotaType) => {
    if (quotaType === 0) return 'violet';
    if (quotaType === 1) return 'teal';
    if (quotaType === 2) return 'orange';
    return 'white';
  };

  const getSecondsPriceItems = (ratio) =>
    Object.entries(modelPriceBySeconds)
      .map(([seconds, price]) => {
        const secondsValue = Number(seconds);
        const priceValue = Number(price);
        if (
          !Number.isFinite(secondsValue) ||
          secondsValue <= 0 ||
          !Number.isFinite(priceValue)
        ) {
          return null;
        }

        return {
          key: `seconds-${seconds}`,
          label: `${secondsValue}${t('秒')}`,
          value: displayPrice(priceValue * ratio),
          suffix: `/ ${t('次')}`,
          seconds: secondsValue,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.seconds - b.seconds);

  const renderSummaryBlock = (items, record) => {
    const hasRegularItems = Array.isArray(items) && items.length > 0;
    const hasSecondsItems =
      Array.isArray(record.secondsPriceItems) && record.secondsPriceItems.length > 0;

    if (!hasRegularItems && !hasSecondsItems) {
      return <span className='text-gray-400'>-</span>;
    }

    return (
      <div className='space-y-2'>
        {hasRegularItems &&
          items.map((item) => (
            <div key={item.key} className='space-y-0.5'>
              <div className='font-semibold text-orange-600'>
                {item.label} {item.value}
              </div>
              <div className='text-xs text-gray-500'>{item.suffix}</div>
            </div>
          ))}

        {hasSecondsItems && (
          <div
            className={
              hasRegularItems
                ? 'pt-2 border-t border-dashed border-gray-200'
                : ''
            }
          >
            <div className='space-y-1.5'>
              {record.secondsPriceItems.map((item) => (
                <div key={item.key} className='space-y-0.5'>
                  <div className='font-semibold text-orange-600'>
                    {item.label} {item.value}
                  </div>
                  <div className='text-xs text-gray-500'>{item.suffix}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderGroupPriceTable = () => {
    const availableGroups = Object.keys(usableGroup || {})
      .filter((g) => g !== '')
      .filter((g) => g !== 'auto')
      .filter((g) => modelEnableGroups.includes(g));

    const tableData = availableGroups.map((group) => {
      const priceData = modelData
        ? calculateModelPrice({
            record: modelData,
            selectedGroup: group,
            groupRatio,
            tokenUnit,
            displayPrice,
            currency,
            quotaDisplayType: siteDisplayType,
          })
        : { inputPrice: '-', outputPrice: '-', price: '-' };

      const groupRatioValue =
        groupRatio && groupRatio[group] ? groupRatio[group] : 1;
      const isDurationBilling = modelData?.quota_type === 2;

      return {
        key: group,
        group,
        ratio: groupRatioValue,
        quotaType: modelData?.quota_type,
        billingType: getBillingTypeLabel(modelData?.quota_type),
        priceItems: isDurationBilling
          ? []
          : getModelPriceItems(priceData, t, siteDisplayType),
        secondsPriceItems: getSecondsPriceItems(groupRatioValue),
      };
    });

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

    columns.push({
      title: t('计费类型'),
      dataIndex: 'billingType',
      render: (text, record) => (
        <Tag
          color={getBillingTypeColor(record.quotaType)}
          size='small'
          shape='circle'
        >
          {text || '-'}
        </Tag>
      ),
    });

    columns.push({
      title: siteDisplayType === 'TOKENS' ? t('计费摘要') : t('价格摘要'),
      dataIndex: 'priceItems',
      render: (items, record) => renderSummaryBlock(items, record),
    });

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
          <div className='text-xs text-gray-600'>{t('不同用户分组的价格信息')}</div>
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
