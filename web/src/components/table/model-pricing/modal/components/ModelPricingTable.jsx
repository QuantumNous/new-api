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
import { calculateModelPrice } from '../../../../../helpers';

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
        : { inputPrice: '-', outputPrice: '-', price: '-' };

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
      // 按量计费
      columns.push(
        {
          title: t('提示'),
          dataIndex: 'inputPrice',
          render: (text) => (
            <>
              <div className='font-semibold text-orange-600'>{text}</div>
              <div className='text-xs text-gray-500'>
                / {tokenUnit === 'K' ? '1K' : '1M'} tokens
              </div>
            </>
          ),
        },
        {
          title: t('补全'),
          dataIndex: 'outputPrice',
          render: (text) => (
            <>
              <div className='font-semibold text-orange-600'>{text}</div>
              <div className='text-xs text-gray-500'>
                / {tokenUnit === 'K' ? '1K' : '1M'} tokens
              </div>
            </>
          ),
        },
      );
    } else {
      // 按次计费
      columns.push({
        title: t('价格'),
        dataIndex: 'fixedPrice',
        render: (text) => (
          <>
            <div className='font-semibold text-orange-600'>{text}</div>
            <div className='text-xs text-gray-500'>/ 次</div>
          </>
        ),
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

  const formatTokenCount = (count) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(0)}K`;
    return String(count);
  };

  const renderTieredPricing = () => {
    const tiers = modelData?.tiered_pricing;
    if (!tiers || tiers.length === 0 || modelData?.quota_type !== 0) return null;

    // Build tier ranges: base tier + defined tiers
    const baseModelRatio = modelData.model_ratio || 0;
    const baseCompletionRatio = modelData.completion_ratio || 1;
    const allTiers = [];

    // Determine the first tier's upper bound
    const firstThreshold = tiers[0]?.threshold || 0;
    allTiers.push({
      label: `0 - ${formatTokenCount(firstThreshold)}`,
      modelRatio: baseModelRatio,
      completionRatio: baseCompletionRatio,
    });

    tiers.forEach((tier, idx) => {
      const nextThreshold = idx < tiers.length - 1 ? tiers[idx + 1].threshold : null;
      const label = nextThreshold
        ? `${formatTokenCount(tier.threshold + 1)} - ${formatTokenCount(nextThreshold)}`
        : `${formatTokenCount(tier.threshold + 1)}+`;
      allTiers.push({
        label,
        modelRatio: tier.model_ratio,
        completionRatio: tier.completion_ratio,
      });
    });

    // Use the first available group ratio
    let usedGroupRatio = 1;
    const availableGroups = Object.keys(usableGroup || {})
      .filter((g) => g !== '' && g !== 'auto')
      .filter((g) => modelEnableGroups.includes(g));
    if (availableGroups.length > 0) {
      const firstGroup = availableGroups[0];
      usedGroupRatio = groupRatio?.[firstGroup] ?? 1;
    }

    let symbol = '$';
    if (currency === 'CNY') symbol = '¥';

    const unitDivisor = tokenUnit === 'K' ? 1000 : 1;
    const unitLabel = tokenUnit === 'K' ? '1K' : '1M';

    return (
      <Card className='!rounded-2xl shadow-sm border-0 mt-4'>
        <div className='flex items-center mb-2'>
          <Avatar size='small' color='green' className='mr-2 shadow-md'>
            <IconCoinMoneyStroked size={16} />
          </Avatar>
          <div>
            <Text className='text-lg font-medium'>{t('分段计费')}</Text>
            <div className='text-xs text-gray-600'>
              {t('基于 prompt 侧 token 数量')}
            </div>
          </div>
        </div>
        <div className='grid gap-3' style={{ gridTemplateColumns: `repeat(${allTiers.length}, 1fr)` }}>
          {allTiers.map((tier, idx) => {
            const inputPriceUSD = tier.modelRatio * 2 * usedGroupRatio;
            const outputPriceUSD = tier.modelRatio * tier.completionRatio * 2 * usedGroupRatio;
            const numInput = (currency === 'CNY' ? inputPriceUSD * 7.3 : inputPriceUSD) / unitDivisor;
            const numOutput = (currency === 'CNY' ? outputPriceUSD * 7.3 : outputPriceUSD) / unitDivisor;

            return (
              <div
                key={idx}
                className='rounded-xl p-3'
                style={{
                  border: '1px solid var(--semi-color-border)',
                  backgroundColor: idx > 0 ? 'var(--semi-color-warning-light-default)' : 'var(--semi-color-fill-0)',
                }}
              >
                <div className='flex items-center justify-between mb-2'>
                  <Text strong className='text-sm'>{tier.label}</Text>
                  <Text type='tertiary' className='text-xs'>per {unitLabel} tokens</Text>
                </div>
                <div className='grid grid-cols-2 gap-2'>
                  <div>
                    <div className='text-xs text-gray-500'>{t('输入')}</div>
                    <div className='font-semibold text-orange-600'>
                      {symbol}{numInput.toFixed(4)}
                    </div>
                  </div>
                  <div>
                    <div className='text-xs text-gray-500'>{t('输出')}</div>
                    <div className='font-semibold text-orange-600'>
                      {symbol}{numOutput.toFixed(4)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    );
  };

  return (
    <>
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
      {renderTieredPricing()}
    </>
  );
};

export default ModelPricingTable;
