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
import { Avatar, Typography, Table, Tag } from '@douyinfe/semi-ui';
import { IconCoinMoneyStroked } from '@douyinfe/semi-icons';
import {
  calculateModelPrice,
  getModelPriceItems,
  resolveGroupBillingMode,
  parseTiersFromExpr,
  getCurrencyConfig,
} from '../../../../../helpers';
import { BILLING_PRICING_VARS } from '../../../../../constants';

const { Text } = Typography;

// 把某个分组生效的分级表达式渲染成「逐档·按组」的价格条目,口径与卡片摘要
// (utils.jsx 的 coeff × group_ratio × rate)以及后端结算(表达式价 × group_ratio)一致。
// 替换原先「见上方动态计费详情」的空占位——那条占位指向模型级 DynamicPricingBreakdown,
// 既不乘分组倍率、也不读分组覆盖后的表达式,导致侧拉「所见≠所付」。
const buildDynamicPriceItems = (billingExpr, groupRatioValue, t) => {
  const tiers = parseTiersFromExpr(billingExpr || '');
  if (!tiers.length) return null;
  const { symbol, rate } = getCurrencyConfig();
  const gr = Number.isFinite(Number(groupRatioValue))
    ? Number(groupRatioValue)
    : 1;
  const multi = tiers.length > 1;
  const items = [];
  tiers.forEach((tier, tierIndex) => {
    BILLING_PRICING_VARS.forEach((v) => {
      const coeff = Number(tier[v.field]);
      if (!Number.isFinite(coeff) || coeff <= 0) return;
      const tierLabel = multi ? `${tier.label || t('默认')} · ` : '';
      items.push({
        key: `tier-${tierIndex}-${v.field}`,
        label: `${tierLabel}${t(v.shortLabel)}`,
        value: `${symbol}${(coeff * gr * rate).toFixed(4)}`,
        suffix: '/ 1M Tokens',
      });
    });
  });
  return items.length ? items : null;
};

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
            quotaDisplayType: siteDisplayType,
          })
        : { inputPrice: '-', outputPrice: '-', price: '-' };

      // 获取分组倍率
      const groupRatioValue =
        groupRatio && groupRatio[group] ? groupRatio[group] : 1;

      // 该分组生效的计费方式（分组覆盖优先）决定计费类型标签
      const groupMode = resolveGroupBillingMode(modelData, group);

      // 动态计费分组:用该分组生效的表达式 + 有效倍率渲染逐档价,口径同卡片摘要;
      // 解析失败才回退到占位条目(getModelPriceItems 的 isDynamic 提示)。
      let priceItems = getModelPriceItems(priceData, t, siteDisplayType);
      if (priceData?.isDynamicPricing) {
        const dynamicItems = buildDynamicPriceItems(
          priceData.billingExpr,
          priceData.usedGroupRatio,
          t,
        );
        if (dynamicItems) priceItems = dynamicItems;
      }

      return {
        key: group,
        group: group,
        ratio: groupRatioValue,
        billingType:
          groupMode === 'tiered_expr'
            ? t('动态计费')
            : groupMode === 'per-request'
              ? t('按次计费')
              : t('按量计费'),
        priceItems,
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

    const isDynamic =
      modelData?.billing_mode === 'tiered_expr' ||
      availableGroups.some(
        (g) => resolveGroupBillingMode(modelData, g) === 'tiered_expr',
      );

    // 动态计费时始终显示倍率列，否则根据设置
    if (showRatio || isDynamic) {
      columns.push({
        title: t('分组倍率'),
        dataIndex: 'ratio',
        render: (text) => (
          <Tag color='blue' size='small' shape='circle'>
            {text}x
          </Tag>
        ),
      });
    }

    columns.push({
      title: t('计费类型'),
      dataIndex: 'billingType',
      render: (text) => {
        let color = 'white';
        if (text === t('按量计费')) color = 'violet';
        else if (text === t('按次计费')) color = 'teal';
        else if (text === t('动态计费')) color = 'amber';
        return (
          <Tag color={color} size='small' shape='circle'>
            {text || '-'}
          </Tag>
        );
      },
    });

    columns.push({
      title: siteDisplayType === 'TOKENS' ? t('计费摘要') : t('价格摘要'),
      dataIndex: 'priceItems',
      render: (items) => {
        if (items.length === 1 && items[0].isDynamic) {
          return (
            <Text type='tertiary' size='small'>
              {t('见上方动态计费详情')}
            </Text>
          );
        }
        return (
          <div className='space-y-1'>
            {items.map((item) => (
              <div key={item.key}>
                <div className='font-semibold text-orange-600'>
                  {item.label} {item.value}
                </div>
                <div className='text-xs text-gray-500'>{item.suffix}</div>
              </div>
            ))}
          </div>
        );
      },
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
    <div>
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
    </div>
  );
};

export default ModelPricingTable;
