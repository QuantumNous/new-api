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
import { calculateModelPrice, getQuotaPerUnit } from '../../../../../helpers';

const { Text } = Typography;

// 获取1倍率对应的基础价格 (USD/1M tokens)
// quotaPerUnit 默认为 500000，表示 $0.002 / 1K tokens = $2 / 1M tokens
// 公式: 1 / (quotaPerUnit / 1000000) = 1000000 / quotaPerUnit
const getRatioBasePrice = () => {
  const quotaPerUnit = getQuotaPerUnit() || 500000;
  return 1000000 / quotaPerUnit;
};

const ModelPricingTable = ({
  modelData,
  groupRatio,
  currency,
  tokenUnit,
  displayPrice,
  showRatio,
  usableGroup,
  autoGroups = [],
  tokenTierPricing,
  t,
}) => {
  const modelEnableGroups = Array.isArray(modelData?.enable_groups)
    ? modelData.enable_groups
    : [];
  const autoChain = autoGroups.filter((g) => modelEnableGroups.includes(g));

  // 获取模型的分段计费配置
  const getTierConfig = () => {
    if (!tokenTierPricing?.global_enabled || !modelData?.model_name) {
      return null;
    }

    const modelConfigs = tokenTierPricing.model_configs || {};
    // Sort configs by priority to ensure deterministic matching order (高优先级数值优先)
    const configs = Object.values(modelConfigs)
      .filter((c) => c?.enabled)
      .sort((a, b) => (b?.priority ?? 0) - (a?.priority ?? 0));

    for (const config of configs) {
      if (!config.enabled) continue;

      const models = config.models?.split(',').map((m) => m.trim()) || [];
      const isMatched = models.some((pattern) => {
        if (pattern.endsWith('*')) {
          const prefix = pattern.slice(0, -1);
          return modelData.model_name.startsWith(prefix);
        }
        return modelData.model_name === pattern;
      });

      if (isMatched) {
        return config;
      }
    }
    return null;
  };

  const tierConfig = getTierConfig();

  // 计算分段价格
  // 注意：价格按 1M tokens 计算，如果 tokenUnit 为 'K'，需要除以 1000
  const calculateTierPrice = (rule, groupRatioValue) => {
    const ratioBasePrice = getRatioBasePrice();
    // tokenUnit 为 'K' 时，价格需要除以 1000（从 /1M 转换为 /1K）
    const unitDivisor = tokenUnit === 'K' ? 1000 : 1;
    // 1K tokens 价格较小，需要更多小数位（4位）
    const formatTierPrice = (price) => `$${price.toFixed(4)}`;
    // 价格模式：任一价格字段非零；倍率模式：使用 input_ratio
    // 注意：当前后端仅保存倍率模式（价格始终为 0），此处保留价格模式支持以备将来扩展
    const hasPrice =
      (rule.input_price ?? 0) !== 0 || (rule.output_price ?? 0) !== 0;
    if (hasPrice) {
      // 价格模式 (Price Mode)
      const inputPriceUSD = ((rule.input_price ?? 0) * groupRatioValue) / unitDivisor;
      const outputPriceUSD = ((rule.output_price ?? 0) * groupRatioValue) / unitDivisor;
      return {
        inputPrice: formatTierPrice(inputPriceUSD),
        outputPrice: formatTierPrice(outputPriceUSD),
      };
    } else {
      // 倍率模式 - 转换为价格显示 (Ratio Mode)
      // 1 Ratio = ratioBasePrice / 1M tokens (默认 $2.0)
      const inputRatio = rule.input_ratio ?? 0;
      const completionRatio = rule.completion_ratio ?? 1.0;
      const inputRatioPrice = (inputRatio * ratioBasePrice * groupRatioValue) / unitDivisor;
      // Output price is derived from input ratio * completion ratio (default logic) or output_ratio if available
      const outputRatio = rule.output_ratio ?? (inputRatio * completionRatio);
      const outputRatioPrice = (outputRatio * ratioBasePrice * groupRatioValue) / unitDivisor;

      return {
        inputPrice: formatTierPrice(inputRatioPrice),
        outputPrice: formatTierPrice(outputRatioPrice),
      };
    }
  };

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
        width: 150,
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
        width: 80,
        render: (text) => (
          <Tag color='white' size='small' shape='circle'>
            {text}x
          </Tag>
        ),
      });
    }

    // 不再显示计费类型列

    // 根据计费类型添加价格列
    if (modelData?.quota_type === 0) {
      // 按量计费
      columns.push(
        {
          title: t('提示'),
          dataIndex: 'inputPrice',
          width: 120,
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
          width: 120,
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
        width: 120,
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
        defaultExpandAllRows={tierConfig && tierConfig.rules && tierConfig.rules.length > 0}
        expandedRowRender={
          tierConfig && tierConfig.rules && tierConfig.rules.length > 0
            ? (record) => {
              const tierData = tierConfig.rules.map((rule, index) => {
                const prices = calculateTierPrice(rule, record.ratio);
                const conditions = [];
                // Helper function to format token count (根据 tokenUnit 调整单位)
                const formatTokens = (tokens) => {
                  const divisor = tokenUnit === 'K' ? 1000 : 1000000;
                  const suffix = tokenUnit === 'K' ? 'K' : 'M';
                  if (tokens >= divisor) {
                    return `${(tokens / divisor).toFixed(tokenUnit === 'K' ? 0 : 3)}${suffix}`;
                  }
                  return tokens.toString();
                };
                if (rule.max_input_tokens > 0) {
                  conditions.push(rule.min_input_tokens > 0
                    ? `${formatTokens(rule.min_input_tokens)} ≤ ${t('输入')} ≤ ${formatTokens(rule.max_input_tokens)}`
                    : `${t('输入')} ≤ ${formatTokens(rule.max_input_tokens)}`);
                } else if (rule.min_input_tokens > 0) {
                  conditions.push(`${t('输入')} ≥ ${formatTokens(rule.min_input_tokens)}`);
                }
                if (rule.max_output_tokens > 0) {
                  conditions.push(rule.min_output_tokens > 0
                    ? `${formatTokens(rule.min_output_tokens)} ≤ ${t('输出')} ≤ ${formatTokens(rule.max_output_tokens)}`
                    : `${t('输出')} ≤ ${formatTokens(rule.max_output_tokens)}`);
                } else if (rule.min_output_tokens > 0) {
                  conditions.push(`${t('输出')} ≥ ${formatTokens(rule.min_output_tokens)}`);
                }
                return {
                  key: index,
                  name: rule.name || `T${index + 1}`,
                  condition: conditions.join(' & ') || t('默认'),
                  inputPrice: prices.inputPrice,
                  outputPrice: prices.outputPrice,
                };
              });
              return (
                <div className='bg-gradient-to-r from-blue-50 to-indigo-50 py-2 px-4'>
                  {tierData.map((tier, idx) => (
                    <div key={tier.key} className={`flex items-center justify-between py-2 ${idx < tierData.length - 1 ? 'border-b border-blue-100' : ''}`}>
                      <div className='flex-1'>
                        <Tag color='cyan' size='small' className='font-semibold'>{tier.name}</Tag>
                        <div className='text-gray-500 text-xs mt-1'>{tier.condition}</div>
                      </div>
                      <div className='flex'>
                        <div style={{ width: 120 }}>
                          <div className='text-xs text-gray-500'>{t('提示')}</div>
                          <div className='font-semibold text-orange-600'>{tier.inputPrice}</div>
                          <div className='text-xs text-gray-500'>/ {tokenUnit === 'K' ? '1K' : '1M'} tokens</div>
                        </div>
                        <div style={{ width: 120 }}>
                          <div className='text-xs text-gray-500'>{t('补全')}</div>
                          <div className='font-semibold text-orange-600'>{tier.outputPrice}</div>
                          <div className='text-xs text-gray-500'>/ {tokenUnit === 'K' ? '1K' : '1M'} tokens</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            }
            : undefined
        }
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
            {tierConfig
              ? t('不同用户分组的价格信息（包含分段计费）')
              : t('不同用户分组的价格信息')}
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
      {tierConfig && (
        <div className='mb-4 p-3 bg-purple-50 rounded-lg'>
          <div className='text-sm text-purple-700'>
            <span className='font-semibold'>{t('提示')}: </span>
            {t('此模型启用了分段计费，已展开显示各阶段价格详情')}
          </div>
        </div>
      )}
      {renderGroupPriceTable()}
    </Card>
  );
};

export default ModelPricingTable;
