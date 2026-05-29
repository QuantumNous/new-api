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

import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Empty,
  SideSheet,
  Skeleton,
  Table,
  Tabs,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import {
  IconClose,
  IconCode,
  IconInfoCircle,
  IconPulse,
} from '@douyinfe/semi-icons';
import {
  API,
  calculateModelPrice,
  getDynamicPriceEntries,
  getDynamicPricingSummary,
  getDynamicPricingTiers,
  getModelPriceItems,
  showError,
} from '../../../../helpers';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';
import DynamicPricingBreakdown from './components/DynamicPricingBreakdown';
import ModelEndpoints from './components/ModelEndpoints';
import ModelHeader from './components/ModelHeader';
import {
  formatTokenCount,
  formatYearMonth,
  inferApiInfo,
  inferModelMetadata,
} from './components/modelMetadata';
import './ModelDetailSideSheet.css';

const { Text, Paragraph } = Typography;
const SHOW_KNOWLEDGE_CUTOFF = false;
const SHOW_RELEASE_DATE = false;
const SHOW_DATA_RETENTION = false;

const EXCLUDED_GROUPS = ['', 'auto'];

const CAPABILITY_LABELS = {
  function_calling: '函数调用',
  streaming: '流式输出',
  vision: '视觉',
  json_mode: 'JSON 模式',
  structured_output: '结构化输出',
  reasoning: '推理',
  tools: '工具调用',
  system_prompt: '系统提示词',
  web_search: '联网搜索',
  code_interpreter: '代码解释器',
  caching: '提示词缓存',
  embeddings: '向量化',
};

const MODALITY_LABELS = {
  text: '文本',
  image: '图片',
  audio: '音频',
  video: '视频',
  file: '文件',
};
const PRICE_FIELD_LABELS = {
  inputPrice: '输入',
  outputPrice: '输出',
  cacheReadPrice: '缓存读取',
  cacheCreatePrice: '缓存写入',
  cacheCreate1hPrice: '1h缓存写入',
  imagePrice: '图片输入',
  imageOutputPrice: '图片输出',
  audioInputPrice: '音频输入',
  audioOutputPrice: '音频输出',
};

const formatMetric = (value, digits = 2, suffix = 't/s') => {
  if (!Number.isFinite(value)) return '-';
  return `${Number(value).toFixed(digits)} ${suffix}`;
};

const averageMetric = (groups, key) => {
  const values = (groups || [])
    .map((item) => Number(item?.[key]))
    .filter((value) => Number.isFinite(value) && value >= 0);
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const parseTags = (tagsString) => {
  if (!tagsString) return [];
  return tagsString
    .split(/[,;|\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
};

const isDynamicPricingModel = (modelData) =>
  modelData?.billing_mode === 'tiered_expr' && !!modelData?.billing_expr;

const getAvailableGroups = (modelData, usableGroup) => {
  const enabledGroups = Array.isArray(modelData?.enable_groups)
    ? modelData.enable_groups
    : [];
  return Object.keys(usableGroup || {})
    .filter((group) => !EXCLUDED_GROUPS.includes(group))
    .filter((group) => enabledGroups.includes(group));
};

const usePerfGroups = (visible, modelName) => {
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const loadMetrics = async () => {
      if (!visible || !modelName) {
        if (!cancelled) {
          setGroups([]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        const res = await API.get('/api/perf-metrics', {
          params: { model: modelName, hours: 24 },
          skipErrorHandler: true,
        });
        const { success, message, data } = res.data || {};
        if (!cancelled) {
          if (success) {
            setGroups(Array.isArray(data?.groups) ? data.groups : []);
          } else {
            setGroups([]);
            if (message) showError(message);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setGroups([]);
          showError(error);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadMetrics();
    return () => {
      cancelled = true;
    };
  }, [visible, modelName]);

  return { loading, groups };
};

const SectionTitle = ({ title, description }) => (
  <div className='model-detail-section-head model-detail-section-head-compact'>
    <div className='model-detail-section-copy'>
      <Text className='model-detail-section-title'>{title}</Text>
      {description ? (
        <div className='model-detail-section-description'>{description}</div>
      ) : null}
    </div>
  </div>
);

const OverviewSummaryGrid = ({ groups, t }) => {
  const cards = [
    {
      key: 'tps',
      label: 'TPS',
      value: formatMetric(averageMetric(groups, 'avg_tps')),
    },
    {
      key: 'latency',
      label: t('平均延迟'),
      value: formatMetric(averageMetric(groups, 'avg_latency_ms'), 0, ' ms'),
    },
    {
      key: 'success',
      label: t('成功率'),
      value: formatMetric(averageMetric(groups, 'success_rate'), 2, '%'),
    },
  ];

  return (
    <Card className='model-detail-section-card'>
      <SectionTitle title={t('概览')} description={t('模型近24小时性能概览')} />
      <div className='model-detail-metric-grid model-detail-overview-grid'>
        {cards.map((item) => (
          <div key={item.key} className='model-detail-metric-card'>
            <div className='model-detail-metric-label'>{item.label}</div>
            <div className='model-detail-metric-value'>{item.value}</div>
          </div>
        ))}
      </div>
    </Card>
  );
};

const BasePriceSection = ({
  modelData,
  groupRatio,
  tokenUnit,
  displayPrice,
  currency,
  siteDisplayType,
  t,
}) => {
  const isDynamic = isDynamicPricingModel(modelData);
  const dynamicSummary = isDynamic
    ? getDynamicPricingSummary(modelData, {
        displayPrice,
        tokenUnit,
        groupRatioMultiplier: 1,
      })
    : null;
  const unitSuffix = `/ 1${tokenUnit} tokens`;

  if (isDynamic && dynamicSummary?.isSpecialExpression) {
    return (
      <div className='model-detail-price-block model-detail-price-block-warning'>
        <div className='model-detail-price-block-title'>
          {t('特殊计费表达式')}
        </div>
        <div className='model-detail-price-block-description'>
          {t('无法解析结构化定价')}
        </div>
        <code className='model-detail-expression-code'>
          {modelData?.billing_expr || '-'}
        </code>
      </div>
    );
  }

  if (isDynamic && dynamicSummary) {
    const primaryEntries = dynamicSummary.primaryEntries;
    const secondaryEntries = dynamicSummary.secondaryEntries;
    return (
      <div className='model-detail-price-stack'>
        <div className='model-detail-price-grid'>
          {primaryEntries.map((entry) => (
            <div key={entry.key} className='model-detail-price-item'>
              <div className='model-detail-price-item-label'>
                {t(PRICE_FIELD_LABELS[entry.field] || entry.shortLabel)}
              </div>
              <div className='model-detail-price-item-main'>
                <div className='model-detail-price-item-value'>
                  {entry.formatted}
                </div>
                <div className='model-detail-price-item-suffix'>
                  {unitSuffix}
                </div>
              </div>
            </div>
          ))}
        </div>
        {secondaryEntries.length > 0 ? (
          <div className='model-detail-price-list'>
            {secondaryEntries.map((entry) => (
              <div key={entry.key} className='model-detail-price-list-row'>
                <span>{t(entry.label)}</span>
                <span className='model-detail-price-inline-value'>
                  {entry.formatted}
                  <em>{` / 1${tokenUnit}`}</em>
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  const priceData = calculateModelPrice({
    record: modelData,
    selectedGroup: 'all',
    groupRatio: groupRatio || {},
    tokenUnit,
    displayPrice,
    currency,
    quotaDisplayType: siteDisplayType,
  });
  const items = getModelPriceItems(priceData, t, siteDisplayType);
  const primaryItems = items.slice(0, 2);
  const secondaryItems = items.slice(2);

  return (
    <div className='model-detail-price-stack'>
      <div className='model-detail-price-grid'>
        {primaryItems.map((item) => (
          <div key={item.key} className='model-detail-price-item'>
            <div className='model-detail-price-item-label'>{item.label}</div>
            <div className='model-detail-price-item-main'>
              <div className='model-detail-price-item-value'>{item.value}</div>
              <div className='model-detail-price-item-suffix'>
                {item.suffix || ''}
              </div>
            </div>
          </div>
        ))}
      </div>
      {secondaryItems.length > 0 ? (
        <div className='model-detail-price-list'>
          {secondaryItems.map((item) => (
            <div key={item.key} className='model-detail-price-list-row'>
              <span>{item.label}</span>
              <span className='model-detail-price-inline-value'>
                {item.value}
                <em>{item.suffix || ''}</em>
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

const GroupPricingSection = ({
  modelData,
  groupRatio,
  usableGroup,
  autoGroups,
  tokenUnit,
  displayPrice,
  currency,
  siteDisplayType,
  t,
}) => {
  const groups = getAvailableGroups(modelData, usableGroup);
  const isDynamic = isDynamicPricingModel(modelData);
  const enabledGroups = Array.isArray(modelData?.enable_groups)
    ? modelData.enable_groups
    : [];
  const autoChain = (autoGroups || []).filter((group) =>
    enabledGroups.includes(group),
  );

  if (groups.length === 0) {
    return (
      <div className='model-detail-empty-state'>
        {t('该模型在任何分组中都不可用，或者尚未配置分组定价信息。')}
      </div>
    );
  }

  if (isDynamic) {
    const tiers = getDynamicPricingTiers(modelData);

    if (!tiers.length) {
      return (
        <div className='model-detail-price-block model-detail-price-block-warning'>
          <div className='model-detail-price-block-title'>
            {t('特殊计费表达式')}
          </div>
          <div className='model-detail-price-block-description'>
            {t('由于该表达式不是标准的分档定价表达式，因此无法展开分组价格。')}
          </div>
          <code className='model-detail-expression-code'>
            {modelData?.billing_expr || '-'}
          </code>
        </div>
      );
    }

    const visibleFields = Array.from(
      new Map(
        tiers
          .flatMap((tier) =>
            getDynamicPriceEntries(tier, {
              displayPrice,
              tokenUnit,
              groupRatioMultiplier: 1,
            }),
          )
          .map((entry) => [entry.field, entry]),
      ).values(),
    );

    return (
      <div className='model-detail-group-stack'>
        {autoChain.length > 0 ? (
          <div className='model-detail-auto-chain'>
            <span className='model-detail-auto-chain-label'>
              {t('自动分组链路')}
            </span>
            <span className='model-detail-auto-chain-arrow'>→</span>
            {autoChain.map((group, index) => (
              <React.Fragment key={group}>
                <Tag
                  className='model-detail-meta-pill'
                  color='white'
                  size='small'
                  shape='circle'
                >
                  {group}
                </Tag>
                {index < autoChain.length - 1 ? (
                  <span className='model-detail-auto-chain-arrow'>→</span>
                ) : null}
              </React.Fragment>
            ))}
          </div>
        ) : null}

        {groups.map((group) => (
          <div key={group} className='model-detail-group-card'>
            <div className='model-detail-group-card-head'>
              <Tag color='blue' shape='circle' size='small'>
                {group}
              </Tag>
              <span className='model-detail-group-card-ratio'>
                {groupRatio?.[group] || 1}x
              </span>
            </div>
            {/* <div className='model-detail-pricing-table-wrap'> </div> */}
            <Table
              bordered={false}
              pagination={false}
              size='small'
              columns={[
                {
                  title: t('档位'),
                  dataIndex: 'label',
                },
                ...visibleFields.map((entry) => ({
                  title: t(PRICE_FIELD_LABELS[entry.field] || entry.shortLabel),
                  dataIndex: entry.field,
                  render: (value) =>
                    value ? (
                      <span className='model-detail-price-inline-value'>
                        {value}
                      </span>
                    ) : (
                      '-'
                    ),
                })),
              ]}
              dataSource={tiers.map((tier, index) => {
                const ratio = Number(groupRatio?.[group] || 1);
                const row = {
                  key: `${group}-${tier.label || index}`,
                  label: tier.label || t('默认'),
                };
                const entries = getDynamicPriceEntries(tier, {
                  displayPrice,
                  tokenUnit,
                  groupRatioMultiplier: ratio,
                });
                const entryMap = new Map(
                  entries.map((entry) => [entry.field, entry]),
                );
                visibleFields.forEach((entry) => {
                  row[entry.field] =
                    entryMap.get(entry.field)?.formatted || '-';
                });
                return row;
              })}
            />
          </div>
        ))}
        <div className='text-[10px] text-[var(--semi-color-text-2)]'>
          {t('价格显示单位')} {`1${tokenUnit} tokens`}
        </div>
      </div>
    );
  }

  const rows = groups.map((group) => {
    const priceData = calculateModelPrice({
      record: modelData,
      selectedGroup: group,
      groupRatio: groupRatio || {},
      tokenUnit,
      displayPrice,
      currency,
      quotaDisplayType: siteDisplayType,
    });
    const items = getModelPriceItems(priceData, t, siteDisplayType);
    return {
      key: group,
      group,
      ratio: groupRatio?.[group] || 1,
      itemMap: Object.fromEntries(items.map((item) => [item.key, item])),
    };
  });

  const priceColumns = Array.from(
    rows.reduce((map, row) => {
      Object.values(row.itemMap).forEach((item) => {
        if (!map.has(item.key)) map.set(item.key, item);
      });
      return map;
    }, new Map()),
  ).map(([, item]) => item);

  return (
    <div className='model-detail-group-stack'>
      {autoChain.length > 0 ? (
        <div className='model-detail-auto-chain'>
          <span className='model-detail-auto-chain-label'>
            {t('自动分组链路')}
          </span>
          <span className='model-detail-auto-chain-arrow'>→</span>
          {autoChain.map((group, index) => (
            <React.Fragment key={group}>
              <Tag
                className='model-detail-meta-pill'
                color='white'
                size='small'
                shape='circle'
              >
                {group}
              </Tag>
              {index < autoChain.length - 1 ? (
                <span className='model-detail-auto-chain-arrow'>→</span>
              ) : null}
            </React.Fragment>
          ))}
        </div>
      ) : null}
      <div className='model-detail-pricing-table-wrap'>
        <Table
          pagination={false}
          size='small'
          columns={[
            {
              title: t('分组'),
              dataIndex: 'group',
              render: (value) => (
                <Tag color='blue' shape='circle' size='small'>
                  {value}
                </Tag>
              ),
            },
            {
              title: t('倍率'),
              dataIndex: 'ratio',
              render: (value) => `${value}x`,
            },
            ...priceColumns.map((item) => ({
              title: item.label,
              dataIndex: item.key,
              render: (_, record) => {
                const target = record.itemMap[item.key];
                return target ? (
                  <span className='model-detail-price-inline-value'>
                    {target.value}
                    <em>{target.suffix || ''}</em>
                  </span>
                ) : (
                  '-'
                );
              },
            })),
          ]}
          dataSource={rows}
        />
      </div>
    </div>
  );
};

const PricingOverview = ({
  modelData,
  groupRatio,
  currency,
  siteDisplayType,
  tokenUnit,
  displayPrice,
  usableGroup,
  autoGroups,
  t,
}) => (
  <Card className='model-detail-section-card model-detail-pricing-card'>
    <SectionTitle
      title={t('定价')}
      description={t('基础价格、动态计费与分组定价')}
    />
    <div className='model-detail-content'>
      <div>
        <Text className='model-detail-subtitle'>{t('基础价格')}</Text>
        <BasePriceSection
          modelData={modelData}
          groupRatio={groupRatio}
          tokenUnit={tokenUnit}
          displayPrice={displayPrice}
          currency={currency}
          siteDisplayType={siteDisplayType}
          t={t}
        />
      </div>

      {isDynamicPricingModel(modelData) ? (
        <div className='model-detail-dynamic-breakdown'>
          <DynamicPricingBreakdown
            billingExpr={modelData.billing_expr}
            tokenUnit={tokenUnit}
            displayPrice={displayPrice}
            t={t}
          />
        </div>
      ) : null}

      <div>
        <Text className='model-detail-subtitle'>{t('按分组定价')}</Text>
        <GroupPricingSection
          modelData={modelData}
          groupRatio={groupRatio}
          usableGroup={usableGroup}
          autoGroups={autoGroups}
          tokenUnit={tokenUnit}
          displayPrice={displayPrice}
          currency={currency}
          siteDisplayType={siteDisplayType}
          t={t}
        />
      </div>
    </div>
  </Card>
);

const QuickStatsCard = ({ metadata, t }) => {
  const stats = [
    {
      key: 'context',
      label: t('上下文'),
      value: formatTokenCount(metadata.context_length),
      hint: t('最大输入窗口'),
    },
    metadata.max_output_tokens > 0
      ? {
          key: 'max-output',
          label: t('最大输出'),
          value: formatTokenCount(metadata.max_output_tokens),
          hint: t('单次响应最大 token 数'),
        }
      : null,
    {
      key: 'modalities',
      label: t('模态'),
      value: `${metadata.input_modalities.join(', ')} -> ${metadata.output_modalities.join(', ')}`,
      hint: t('输入到输出的模态'),
    },
    {
      key: 'knowledge',
      label: t('知识截至'),
      value: formatYearMonth(metadata.knowledge_cutoff),
    },
    {
      key: 'release',
      label: t('发布于'),
      value: formatYearMonth(metadata.release_date),
    },
  ].filter((item) => {
    if (!item) return false;
    if (item.key === 'knowledge') return SHOW_KNOWLEDGE_CUTOFF;
    if (item.key === 'release') return SHOW_RELEASE_DATE;
    return true;
  });

  return (
    <Card className='model-detail-section-card'>
      <SectionTitle title={t('快速信息')} />
      <div className='model-detail-quick-grid'>
        {stats.map((item) => (
          <div key={item.key} className='model-detail-quick-cell'>
            <div className='model-detail-quick-label'>{item.label}</div>
            <div className='model-detail-quick-value'>{item.value}</div>
            {item.hint ? (
              <div className='model-detail-quick-hint'>{item.hint}</div>
            ) : null}
          </div>
        ))}
      </div>
    </Card>
  );
};

const CapabilityCard = ({ metadata, t }) => (
  <Card className='model-detail-section-card'>
    <SectionTitle
      title={`${t('能力')} / ${t('支持的模态')}`}
      description={t('基于模型名称、标签和端点信息推断')}
    />
    <div className='model-detail-capability-layout'>
      <div>
        <div className='model-detail-subtitle'>{t('能力')}</div>
        <div className='model-detail-chip-wrap'>
          {metadata.capabilities.length > 0 ? (
            metadata.capabilities.map((item) => (
              <Tag
                key={item}
                className='model-detail-meta-pill'
                color='white'
                shape='circle'
                size='small'
              >
                {t(CAPABILITY_LABELS[item] || item)}
              </Tag>
            ))
          ) : (
            <span className='model-detail-empty-state'>
              {t('该模型暂无能力信息。')}
            </span>
          )}
        </div>
      </div>

      <div>
        <div className='model-detail-subtitle'>{t('支持的模态')}</div>
        <div className='model-detail-modality-grid'>
          <div className='model-detail-modality-cell'>
            <span>{t('输入')}</span>
            <div className='model-detail-chip-wrap'>
              {metadata.input_modalities.map((item) => (
                <Tag
                  key={`input-${item}`}
                  color='blue'
                  size='small'
                  shape='circle'
                >
                  {t(MODALITY_LABELS[item] || item)}
                </Tag>
              ))}
            </div>
          </div>
          <div className='model-detail-modality-cell'>
            <span>{t('输出')}</span>
            <div className='model-detail-chip-wrap'>
              {metadata.output_modalities.map((item) => (
                <Tag
                  key={`output-${item}`}
                  color='green'
                  size='small'
                  shape='circle'
                >
                  {t(MODALITY_LABELS[item] || item)}
                </Tag>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  </Card>
);

const ProviderInfoCard = ({ modelData, t }) => {
  const info = useMemo(() => inferApiInfo(modelData), [modelData]);

  return (
    <Card className='model-detail-section-card'>
      <SectionTitle title={t('供应商与数据隐私')} />
      <div className='model-detail-provider-grid'>
        <div className='model-detail-provider-cell'>
          <div className='model-detail-quick-label'>{t('供应商')}</div>
          <div className='model-detail-quick-value'>{info.vendor_label}</div>
          {info.homepage ? (
            <a
              href={info.homepage}
              target='_blank'
              rel='noopener noreferrer'
              className='model-detail-provider-link'
            >
              {t('文档')}
            </a>
          ) : null}
        </div>
        <div className='model-detail-provider-cell'>
          <div className='model-detail-quick-label'>{t('分词器')}</div>
          <div className='model-detail-quick-value'>{info.tokenizer}</div>
          {info.tokenizer_note ? (
            <div className='model-detail-quick-hint'>{info.tokenizer_note}</div>
          ) : null}
        </div>
        <div className='model-detail-provider-cell'>
          <div className='model-detail-quick-label'>{t('许可协议')}</div>
          <div className='model-detail-quick-value'>{info.license}</div>
          <div>
            <Tag
              color={
                info.license_kind === 'proprietary'
                  ? 'orange'
                  : info.license_kind === 'open-weight'
                    ? 'blue'
                    : 'white'
              }
              shape='circle'
              size='small'
            >
              {info.license_kind === 'proprietary'
                ? t('闭源商用')
                : info.license_kind === 'open-weight'
                  ? t('开放权重')
                  : info.license_kind === 'open'
                    ? t('开源')
                    : t('未知')}
            </Tag>
          </div>
        </div>
        {SHOW_DATA_RETENTION ? (
          <div className='model-detail-provider-cell'>
            <div className='model-detail-quick-label'>{t('数据保留')}</div>
            <div className='model-detail-quick-value'>
              {info.data_retention_days === 0
                ? t('零数据保留')
                : `${info.data_retention_days} ${t('天')}`}
            </div>
            <div className='model-detail-quick-hint'>
              {info.training_opt_out
                ? t('默认不会用于上游训练')
                : t('上游提供商可能会将数据用于训练')}
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
};

const ModelDescriptionCard = ({ modelData, t }) => {
  const tags = parseTags(modelData?.tags);
  const description =
    modelData?.description || modelData?.vendor_description || t('暂无描述。');

  return (
    <Card className='model-detail-section-card'>
      <SectionTitle
        title={t('模型详情')}
        description={t('概览信息、标签与描述')}
      />
      <Paragraph className='model-detail-description'>{description}</Paragraph>
      {tags.length > 0 ? (
        <div className='model-detail-chip-wrap'>
          {tags.map((item) => (
            <Tag
              key={item}
              className='model-detail-meta-pill'
              color='white'
              shape='circle'
              size='small'
            >
              {item}
            </Tag>
          ))}
        </div>
      ) : null}
    </Card>
  );
};

const PerformanceTab = ({ visible, modelName, t }) => {
  const { loading, groups } = usePerfGroups(visible, modelName);

  const summaryCards = useMemo(
    () => [
      {
        key: 'tps',
        label: 'TPS',
        value: formatMetric(averageMetric(groups, 'avg_tps')),
      },
      {
        key: 'ttft',
        label: 'TTFT',
        value: formatMetric(averageMetric(groups, 'avg_ttft_ms'), 0, ' ms'),
      },
      {
        key: 'latency',
        label: t('平均延迟'),
        value: formatMetric(averageMetric(groups, 'avg_latency_ms'), 0, ' ms'),
      },
      {
        key: 'success',
        label: t('成功率'),
        value: formatMetric(averageMetric(groups, 'success_rate'), 2, '%'),
      },
    ],
    [groups, t],
  );

  return (
    <div className='model-detail-content'>
      <Card className='model-detail-section-card'>
        <SectionTitle title={t('性能指标')} description='24h' />
        {loading ? (
          <Skeleton
            placeholder={<Skeleton.Paragraph rows={8} active />}
            loading
          />
        ) : groups.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t('暂无请求数据')}
          />
        ) : (
          <>
            <div className='model-detail-metric-grid'>
              {summaryCards.map((item) => (
                <div key={item.key} className='model-detail-metric-card'>
                  <div className='model-detail-metric-label'>{item.label}</div>
                  <div className='model-detail-metric-value'>{item.value}</div>
                </div>
              ))}
            </div>
            <div className='model-detail-pricing-table-wrap mt-4'>
              <Table
                columns={[
                  {
                    title: t('分组'),
                    dataIndex: 'group',
                    render: (value) => (
                      <Tag color='white' shape='circle' size='small'>
                        {value || '-'}
                      </Tag>
                    ),
                  },
                  {
                    title: 'TPS',
                    dataIndex: 'avg_tps',
                    render: (value) => formatMetric(Number(value || 0)),
                  },
                  {
                    title: 'TTFT',
                    dataIndex: 'avg_ttft_ms',
                    render: (value) =>
                      formatMetric(Number(value || 0), 0, ' ms'),
                  },
                  {
                    title: t('平均延迟'),
                    dataIndex: 'avg_latency_ms',
                    render: (value) =>
                      formatMetric(Number(value || 0), 0, ' ms'),
                  },
                  {
                    title: t('成功率'),
                    dataIndex: 'success_rate',
                    render: (value) => formatMetric(Number(value || 0), 2, '%'),
                  },
                ]}
                dataSource={groups.map((group, index) => ({
                  key: `${group.group || 'group'}-${index}`,
                  ...group,
                }))}
                pagination={false}
                size='small'
              />
            </div>
          </>
        )}
      </Card>
    </div>
  );
};

const ApiTab = ({ modelData, endpointMap, t }) => (
  <div className='model-detail-content'>
    {/* <Card className='model-detail-section-card'>
      <SectionTitle
        title={t('鉴权方式')}
        description={t('如何通过 API 网关调用该模型')}
      />
      <div className='model-detail-auth-box'>
        <div className='model-detail-auth-line'>
          {t('所有请求都必须包含')}
          <code>Authorization: Bearer &lt;TOKEN&gt;</code>
        </div>
        <div className='model-detail-auth-line'>
          {t('Anthropic 格式端点也接受')}
          <code>x-api-key</code>
          {t('请求头。')}
        </div>
      </div>
    </Card> */}
    <ModelEndpoints modelData={modelData} endpointMap={endpointMap} t={t} />
  </div>
);

const OverviewTab = ({
  visible,
  modelData,
  groupRatio,
  currency,
  siteDisplayType,
  tokenUnit,
  displayPrice,
  usableGroup,
  autoGroups,
  t,
}) => {
  const metadata = useMemo(() => inferModelMetadata(modelData), [modelData]);
  const { groups } = usePerfGroups(visible, modelData?.model_name);

  return (
    <div className='model-detail-content'>
      <OverviewSummaryGrid groups={groups} t={t} />
      <ModelDescriptionCard modelData={modelData} t={t} />
      <PricingOverview
        modelData={modelData}
        groupRatio={groupRatio}
        currency={currency}
        siteDisplayType={siteDisplayType}
        tokenUnit={tokenUnit}
        displayPrice={displayPrice}
        usableGroup={usableGroup}
        autoGroups={autoGroups}
        t={t}
      />
      <QuickStatsCard metadata={metadata} t={t} />
      <CapabilityCard metadata={metadata} t={t} />
      <ProviderInfoCard modelData={modelData} t={t} />
    </div>
  );
};

const ModelDetailSideSheetV2 = ({
  visible,
  onClose,
  modelData,
  groupRatio,
  currency,
  siteDisplayType,
  tokenUnit,
  displayPrice,
  usableGroup,
  endpointMap,
  autoGroups,
  t,
}) => {
  const isMobile = useIsMobile();

  return (
    <SideSheet
      className='model-detail-sheet'
      placement='right'
      title={<ModelHeader modelData={modelData} t={t} />}
      bodyStyle={{
        padding: '0',
        display: 'flex',
        flexDirection: 'column',
        borderBottom: '1px solid var(--semi-color-border)',
      }}
      visible={visible}
      width={isMobile ? '100%' : 960}
      closeIcon={
        <Button
          className='semi-button-tertiary semi-button-size-small semi-button-borderless'
          type='button'
          icon={<IconClose />}
          onClick={onClose}
        />
      }
      onCancel={onClose}
    >
      <div className='model-detail-modal model-detail-modal-v2'>
        {!modelData ? (
          <div className='model-detail-loading'>
            <Text type='secondary'>{t('加载中...')}</Text>
          </div>
        ) : (
          <Tabs type='line'>
            <Tabs.TabPane
              itemKey='overview'
              tab={
                <span className='flex gap-1'>
                  <IconInfoCircle />
                  {t('概览')}
                </span>
              }
            >
              <OverviewTab
                visible={visible}
                modelData={modelData}
                groupRatio={groupRatio}
                currency={currency}
                siteDisplayType={siteDisplayType}
                tokenUnit={tokenUnit}
                displayPrice={displayPrice}
                usableGroup={usableGroup}
                endpointMap={endpointMap}
                autoGroups={autoGroups}
                t={t}
              />
            </Tabs.TabPane>
            <Tabs.TabPane
              itemKey='performance'
              tab={
                <span className='flex gap-1'>
                  <IconPulse />
                  {t('性能指标')}
                </span>
              }
            >
              <PerformanceTab
                visible={visible}
                modelName={modelData.model_name}
                t={t}
              />
            </Tabs.TabPane>
            <Tabs.TabPane
              itemKey='api'
              tab={
                <span className='flex gap-1'>
                  <IconCode />
                  {t('API端点')}
                </span>
              }
            >
              <ApiTab modelData={modelData} endpointMap={endpointMap} t={t} />
            </Tabs.TabPane>
          </Tabs>
        )}
      </div>
    </SideSheet>
  );
};

export default ModelDetailSideSheetV2;
