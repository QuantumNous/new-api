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
import {
  Avatar,
  Space,
  Tag,
  Tooltip,
  Popover,
  Typography,
  Button,
} from '@douyinfe/semi-ui';
import {
  renderGroup,
  renderQuota,
  stringToColor,
  getLogOther,
  renderModelTag,
  renderModelPriceSimple,
  getCurrencyConfig,
} from '../../../helpers';
import { IconHelpCircle } from '@douyinfe/semi-icons';
import {
  CircleAlert,
  Route,
  Sparkles,
  FileSearch,
  Download,
  Upload,
  Package,
  SquarePen,
} from 'lucide-react';

const CACHE_ACCENT_COLOR = 'rgba(var(--semi-orange-6), 1)';

const DETAIL_TOOLTIP_PANEL_STYLE = {
  minWidth: 220,
  lineHeight: 1.5,
  color: 'rgba(255, 255, 255, 0.92)',
};

const DETAIL_TOOLTIP_SECTION_STYLE = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};

const DETAIL_TOOLTIP_TITLE_STYLE = {
  fontSize: 12,
  fontWeight: 600,
  color: 'rgba(255, 255, 255, 0.72)',
  marginBottom: 4,
};

const DETAIL_TOOLTIP_ROW_STYLE = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  whiteSpace: 'nowrap',
};

const DETAIL_TOOLTIP_LABEL_STYLE = {
  color: 'rgba(255, 255, 255, 0.58)',
};

const DETAIL_TOOLTIP_VALUE_STYLE = {
  color: 'rgba(255, 255, 255, 0.92)',
  fontWeight: 500,
};

const DETAIL_TOOLTIP_TOTAL_STYLE = {
  ...DETAIL_TOOLTIP_ROW_STYLE,
  gap: 24,
  borderTop: '1px solid rgba(255, 255, 255, 0.18)',
  paddingTop: 6,
  marginTop: 6,
};

const colors = [
  'amber',
  'blue',
  'cyan',
  'green',
  'grey',
  'indigo',
  'light-blue',
  'lime',
  'orange',
  'pink',
  'purple',
  'red',
  'teal',
  'violet',
  'yellow',
];

function formatRatio(ratio) {
  if (ratio === undefined || ratio === null) {
    return '-';
  }
  if (typeof ratio === 'number') {
    return ratio.toFixed(4);
  }
  return String(ratio);
}

function buildChannelAffinityTooltip(affinity, t) {
  if (!affinity) {
    return null;
  }

  const keySource = affinity.key_source || '-';
  const keyPath = affinity.key_path || affinity.key_key || '-';
  const keyHint = affinity.key_hint || '';
  const keyFp = affinity.key_fp ? `#${affinity.key_fp}` : '';
  const keyText = `${keySource}:${keyPath}${keyFp}`;

  const lines = [
    t('渠道亲和性'),
    `${t('规则')}：${affinity.rule_name || '-'}`,
    `${t('分组')}：${affinity.selected_group || '-'}`,
    `${t('Key')}：${keyText}`,
    ...(keyHint ? [`${t('Key 摘要')}：${keyHint}`] : []),
  ];

  return (
    <div style={{ lineHeight: 1.6, display: 'flex', flexDirection: 'column' }}>
      {lines.map((line, i) => (
        <div key={i}>{line}</div>
      ))}
    </div>
  );
}

// Render functions
function renderType(type, t) {
  switch (type) {
    case 1:
      return (
        <Tag color='cyan' shape='circle'>
          {t('充值')}
        </Tag>
      );
    case 2:
      return (
        <Tag color='lime' shape='circle'>
          {t('消费')}
        </Tag>
      );
    case 3:
      return (
        <Tag color='orange' shape='circle'>
          {t('管理')}
        </Tag>
      );
    case 4:
      return (
        <Tag color='purple' shape='circle'>
          {t('系统')}
        </Tag>
      );
    case 5:
      return (
        <Tag color='red' shape='circle'>
          {t('错误')}
        </Tag>
      );
    case 6:
      return (
        <Tag color='teal' shape='circle'>
          {t('退款')}
        </Tag>
      );
    default:
      return (
        <Tag color='grey' shape='circle'>
          {t('未知')}
        </Tag>
      );
  }
}

function buildStreamStatusTooltip(ss, t) {
  if (!ss) return null;
  const lines = [t('流状态') + '：' + t('异常'), ss.end_reason || 'unknown'];
  if (ss.error_count > 0) {
    lines.push(`${t('软错误')}: ${ss.error_count}`);
  }
  if (ss.end_error) {
    lines.push(ss.end_error);
  }
  return (
    <div style={{ lineHeight: 1.6, display: 'flex', flexDirection: 'column' }}>
      {lines.map((line, i) => (
        <div key={i}>{line}</div>
      ))}
    </div>
  );
}

function renderIsStream(bool, t, streamStatus) {
  const isError = streamStatus && streamStatus.status !== 'ok';

  if (bool) {
    return (
      <span style={{ position: 'relative', display: 'inline-block' }}>
        <Tag color='blue' shape='circle'>
          {t('流')}
        </Tag>
        {isError && (
          <Tooltip content={buildStreamStatusTooltip(streamStatus, t)}>
            <span
              style={{
                position: 'absolute',
                right: -4,
                top: -4,
                lineHeight: 1,
                color: '#ef4444',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <CircleAlert size={14} strokeWidth={2.5} color='currentColor' />
            </span>
          </Tooltip>
        )}
      </span>
    );
  } else {
    return (
      <Tag color='purple' shape='circle'>
        {t('非流')}
      </Tag>
    );
  }
}

function renderUseTime(type, t) {
  const time = parseInt(type);
  if (time < 101) {
    return (
      <Tag color='green' shape='circle'>
        {' '}
        {time} s{' '}
      </Tag>
    );
  } else if (time < 300) {
    return (
      <Tag color='orange' shape='circle'>
        {' '}
        {time} s{' '}
      </Tag>
    );
  } else {
    return (
      <Tag color='red' shape='circle'>
        {' '}
        {time} s{' '}
      </Tag>
    );
  }
}

function renderFirstUseTime(type, t) {
  let time = parseFloat(type) / 1000.0;
  time = time.toFixed(1);
  if (time < 3) {
    return (
      <Tag color='green' shape='circle'>
        {' '}
        {time} s{' '}
      </Tag>
    );
  } else if (time < 10) {
    return (
      <Tag color='orange' shape='circle'>
        {' '}
        {time} s{' '}
      </Tag>
    );
  } else {
    return (
      <Tag color='red' shape='circle'>
        {' '}
        {time} s{' '}
      </Tag>
    );
  }
}

function renderBillingTag(record, t) {
  const other = getLogOther(record.other);
  if (other?.billing_source === 'subscription') {
    return (
      <Tag color='green' shape='circle'>
        {t('订阅抵扣')}
      </Tag>
    );
  }
  return null;
}

function renderCacheCostLine(icon, label, quota) {
  if (!quota || quota <= 0) {
    return null;
  }

  const Icon = icon;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        marginTop: 2,
        color: CACHE_ACCENT_COLOR,
        fontSize: 11,
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
      }}
    >
      <Icon size={11} strokeWidth={2.2} color='currentColor' />
      <span>
        {label} {renderQuota(quota, 6)}
      </span>
    </span>
  );
}

function renderTokenValue(icon, label, value, color) {
  const Icon = icon;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        color,
        whiteSpace: 'nowrap',
      }}
    >
      <Icon size={12} strokeWidth={2.2} color='currentColor' />
      <span>{formatTokenCount(value)}</span>
    </span>
  );
}

function renderCacheTokenLine(icon, label, value) {
  if (!value || value <= 0) {
    return null;
  }

  const Icon = icon;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        marginTop: 2,
        color: CACHE_ACCENT_COLOR,
        fontSize: 11,
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
        }}
      >
        <Icon size={11} strokeWidth={2.2} color='currentColor' />
        <span>
          {label} {formatTokenCount(value)}
        </span>
      </span>
    </span>
  );
}

function DetailTooltipRow({ label, value, valueStyle = null }) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return (
    <div style={DETAIL_TOOLTIP_ROW_STYLE}>
      <span style={DETAIL_TOOLTIP_LABEL_STYLE}>{label}</span>
      <span style={{ ...DETAIL_TOOLTIP_VALUE_STYLE, ...valueStyle }}>
        {value}
      </span>
    </div>
  );
}

function formatDisplayMoneyFromUsd(usdAmount, digits = 6) {
  const amount = Number(usdAmount);
  if (!Number.isFinite(amount)) {
    return null;
  }

  const { symbol, rate, type } = getCurrencyConfig();
  if (type === 'TOKENS') {
    return renderQuota(Math.round(amount), 6);
  }

  return `${symbol}${(amount * rate).toFixed(digits)}`;
}

function formatUnitPriceFromUsd(usdAmount) {
  const formatted = formatDisplayMoneyFromUsd(usdAmount, 4);
  return formatted ? `${formatted} / 1M Token` : null;
}

function getEffectiveGroupRatio(groupRatio, userGroupRatio) {
  const parsedUserGroupRatio = Number(userGroupRatio);
  if (Number.isFinite(parsedUserGroupRatio) && parsedUserGroupRatio !== -1) {
    return parsedUserGroupRatio;
  }

  const parsedGroupRatio = Number(groupRatio);
  return Number.isFinite(parsedGroupRatio) ? parsedGroupRatio : 1;
}

function getCacheWriteBreakdown(record, other) {
  const cacheCreationTokens = toTokenNumber(other?.cache_creation_tokens);
  const cacheCreationTokens5m = toTokenNumber(other?.cache_creation_tokens_5m);
  const cacheCreationTokens1h = toTokenNumber(other?.cache_creation_tokens_1h);
  const splitCacheCreationTokens =
    cacheCreationTokens5m + cacheCreationTokens1h;
  const fallbackCacheWriteTokens = toTokenNumber(record?.cache_write_tokens);

  if (splitCacheCreationTokens > 0) {
    return {
      legacyTokens: Math.max(cacheCreationTokens - splitCacheCreationTokens, 0),
      tokens5m: cacheCreationTokens5m,
      tokens1h: cacheCreationTokens1h,
    };
  }

  return {
    legacyTokens: cacheCreationTokens || fallbackCacheWriteTokens,
    tokens5m: 0,
    tokens1h: 0,
  };
}

function buildTokenDetail(
  record,
  inputTokens,
  cacheReadTokens,
  cacheWriteTokens,
) {
  const outputTokens = toTokenNumber(record?.completion_tokens);
  const totalTokens =
    inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens;

  return {
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    totalTokens,
  };
}

function renderTokenDetailTooltip(detail, t) {
  if (!detail) {
    return null;
  }

  return (
    <div style={DETAIL_TOOLTIP_PANEL_STYLE}>
      <div style={DETAIL_TOOLTIP_SECTION_STYLE}>
        <div style={DETAIL_TOOLTIP_TITLE_STYLE}>{t('Token 明细')}</div>
        <DetailTooltipRow
          label={t('输入 Token')}
          value={formatTokenCount(detail.inputTokens)}
        />
        <DetailTooltipRow
          label={t('输出 Token')}
          value={formatTokenCount(detail.outputTokens)}
        />
        {detail.cacheReadTokens > 0 ? (
          <DetailTooltipRow
            label={t('缓存读取 Token')}
            value={formatTokenCount(detail.cacheReadTokens)}
          />
        ) : null}
        {detail.cacheWriteTokens > 0 ? (
          <DetailTooltipRow
            label={t('缓存写入 Token')}
            value={formatTokenCount(detail.cacheWriteTokens)}
          />
        ) : null}
      </div>
      <div style={DETAIL_TOOLTIP_TOTAL_STYLE}>
        <span style={DETAIL_TOOLTIP_LABEL_STYLE}>{t('总 Token')}</span>
        <span
          style={{
            color: '#60a5fa',
            fontWeight: 600,
          }}
        >
          {formatTokenCount(detail.totalTokens)}
        </span>
      </div>
    </div>
  );
}

function buildCostDetail(record) {
  const other = getLogOther(record?.other);
  const modelPrice = Number(other?.model_price);
  const groupRatio = getEffectiveGroupRatio(
    other?.group_ratio,
    other?.user_group_ratio,
  );
  const billedQuota = toTokenNumber(record?.quota);

  if (Number.isFinite(modelPrice) && modelPrice !== -1) {
    return {
      groupRatio,
      originalAmount: modelPrice,
      billedQuota,
      serviceTier: other?.service_tier || other?.tier || '',
    };
  }

  const modelRatio = Number(other?.model_ratio);
  if (!Number.isFinite(modelRatio)) {
    return {
      groupRatio,
      billedQuota,
      serviceTier: other?.service_tier || other?.tier || '',
    };
  }

  const completionRatio = Number(other?.completion_ratio || 0);
  const cacheRatio = Number(other?.cache_ratio || 1);
  const cacheCreationRatio = Number(other?.cache_creation_ratio || 1);
  const cacheCreationRatio5m = Number(
    other?.cache_creation_ratio_5m || cacheCreationRatio,
  );
  const cacheCreationRatio1h = Number(
    other?.cache_creation_ratio_1h || cacheCreationRatio,
  );
  const inputUnitPrice = modelRatio * 2.0;
  const outputUnitPrice = inputUnitPrice * completionRatio;
  const cacheReadUnitPrice = inputUnitPrice * cacheRatio;
  const cacheWriteUnitPrice = inputUnitPrice * cacheCreationRatio;
  const cacheWriteUnitPrice5m = inputUnitPrice * cacheCreationRatio5m;
  const cacheWriteUnitPrice1h = inputUnitPrice * cacheCreationRatio1h;
  const inputTokens = getPrimaryInputTokens(record, record?.prompt_tokens);
  const outputTokens = toTokenNumber(record?.completion_tokens);
  const cacheReadTokens = toTokenNumber(record?.cache_read_tokens);
  const cacheWriteBreakdown = getCacheWriteBreakdown(record, other);
  const inputAmount = (inputTokens / 1000000) * inputUnitPrice;
  const outputAmount = (outputTokens / 1000000) * outputUnitPrice;
  const cacheReadAmount = (cacheReadTokens / 1000000) * cacheReadUnitPrice;
  const cacheWriteAmount =
    (cacheWriteBreakdown.legacyTokens / 1000000) * cacheWriteUnitPrice +
    (cacheWriteBreakdown.tokens5m / 1000000) * cacheWriteUnitPrice5m +
    (cacheWriteBreakdown.tokens1h / 1000000) * cacheWriteUnitPrice1h;
  const originalAmount =
    inputAmount + outputAmount + cacheReadAmount + cacheWriteAmount;

  return {
    inputAmount,
    outputAmount,
    inputUnitPrice,
    outputUnitPrice,
    cacheReadAmount,
    cacheWriteAmount,
    cacheReadUnitPrice,
    cacheWriteUnitPrice:
      cacheWriteBreakdown.tokens5m > 0 || cacheWriteBreakdown.tokens1h > 0
        ? null
        : cacheWriteUnitPrice,
    cacheWriteUnitPrice5m:
      cacheWriteBreakdown.tokens5m > 0 ? cacheWriteUnitPrice5m : null,
    cacheWriteUnitPrice1h:
      cacheWriteBreakdown.tokens1h > 0 ? cacheWriteUnitPrice1h : null,
    groupRatio,
    originalAmount,
    billedQuota,
    serviceTier: other?.service_tier || other?.tier || '',
  };
}

function renderCostDetailTooltip(detail, t) {
  if (!detail) {
    return null;
  }

  return (
    <div style={DETAIL_TOOLTIP_PANEL_STYLE}>
      <div
        style={{
          ...DETAIL_TOOLTIP_SECTION_STYLE,
          borderBottom: '1px solid rgba(255, 255, 255, 0.18)',
          paddingBottom: 6,
          marginBottom: 6,
        }}
      >
        <div style={DETAIL_TOOLTIP_TITLE_STYLE}>{t('成本明细')}</div>
        <DetailTooltipRow
          label={t('输入成本')}
          value={formatDisplayMoneyFromUsd(detail.inputAmount)}
        />
        <DetailTooltipRow
          label={t('输出成本')}
          value={formatDisplayMoneyFromUsd(detail.outputAmount)}
        />
        <DetailTooltipRow
          label={t('输入单价')}
          value={formatUnitPriceFromUsd(detail.inputUnitPrice)}
          valueStyle={{ color: '#7dd3fc' }}
        />
        <DetailTooltipRow
          label={t('输出单价')}
          value={formatUnitPriceFromUsd(detail.outputUnitPrice)}
          valueStyle={{ color: '#c4b5fd' }}
        />
        {detail.cacheReadAmount > 0 ? (
          <DetailTooltipRow
            label={t('缓存读取成本')}
            value={formatDisplayMoneyFromUsd(detail.cacheReadAmount)}
          />
        ) : null}
        {detail.cacheWriteAmount > 0 ? (
          <DetailTooltipRow
            label={t('缓存写入成本')}
            value={formatDisplayMoneyFromUsd(detail.cacheWriteAmount)}
          />
        ) : null}
        {detail.cacheReadUnitPrice ? (
          <DetailTooltipRow
            label={t('缓存输入价格')}
            value={formatUnitPriceFromUsd(detail.cacheReadUnitPrice)}
            valueStyle={{ color: '#fdba74' }}
          />
        ) : null}
        {detail.cacheWriteUnitPrice ? (
          <DetailTooltipRow
            label={t('缓存输出价格')}
            value={formatUnitPriceFromUsd(detail.cacheWriteUnitPrice)}
            valueStyle={{ color: '#fbbf24' }}
          />
        ) : null}
        {detail.cacheWriteUnitPrice5m ? (
          <DetailTooltipRow
            label={t('5m 缓存输出价格')}
            value={formatUnitPriceFromUsd(detail.cacheWriteUnitPrice5m)}
            valueStyle={{ color: '#fbbf24' }}
          />
        ) : null}
        {detail.cacheWriteUnitPrice1h ? (
          <DetailTooltipRow
            label={t('1h 缓存输出价格')}
            value={formatUnitPriceFromUsd(detail.cacheWriteUnitPrice1h)}
            valueStyle={{ color: '#fbbf24' }}
          />
        ) : null}
      </div>
      <DetailTooltipRow
        label={t('服务档位')}
        value={detail.serviceTier}
        valueStyle={{ color: '#67e8f9', fontWeight: 600 }}
      />
      <DetailTooltipRow
        label={t('倍率')}
        value={`${formatRatio(detail.groupRatio)}x`}
        valueStyle={{ color: '#60a5fa', fontWeight: 600 }}
      />
      <DetailTooltipRow
        label={t('原始')}
        value={formatDisplayMoneyFromUsd(detail.originalAmount)}
      />
      <div style={DETAIL_TOOLTIP_TOTAL_STYLE}>
        <span style={DETAIL_TOOLTIP_LABEL_STYLE}>{t('计费')}</span>
        <span style={{ color: '#4ade80', fontWeight: 600 }}>
          {renderQuota(detail.billedQuota, 6)}
        </span>
      </div>
    </div>
  );
}

function renderModelName(record, copyText, t) {
  let other = getLogOther(record.other);
  let modelMapped =
    other?.is_model_mapped &&
    other?.upstream_model_name &&
    other?.upstream_model_name !== '';
  if (!modelMapped) {
    return renderModelTag(record.model_name, {
      onClick: (event) => {
        copyText(event, record.model_name).then((r) => {});
      },
    });
  } else {
    return (
      <>
        <Space vertical align={'start'}>
          <Popover
            content={
              <div style={{ padding: 10 }}>
                <Space vertical align={'start'}>
                  <div className='flex items-center'>
                    <Typography.Text strong style={{ marginRight: 8 }}>
                      {t('请求并计费模型')}:
                    </Typography.Text>
                    {renderModelTag(record.model_name, {
                      onClick: (event) => {
                        copyText(event, record.model_name).then((r) => {});
                      },
                    })}
                  </div>
                  <div className='flex items-center'>
                    <Typography.Text strong style={{ marginRight: 8 }}>
                      {t('实际模型')}:
                    </Typography.Text>
                    {renderModelTag(other.upstream_model_name, {
                      onClick: (event) => {
                        copyText(event, other.upstream_model_name).then(
                          (r) => {},
                        );
                      },
                    })}
                  </div>
                </Space>
              </div>
            }
          >
            {renderModelTag(record.model_name, {
              onClick: (event) => {
                copyText(event, record.model_name).then((r) => {});
              },
              suffixIcon: (
                <Route
                  style={{ width: '0.9em', height: '0.9em', opacity: 0.75 }}
                />
              ),
            })}
          </Popover>
        </Space>
      </>
    );
  }
}

function toTokenNumber(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return parsed;
}

function formatTokenCount(value) {
  return toTokenNumber(value).toLocaleString();
}

function getPrimaryInputTokens(record, fallbackValue) {
  const other = getLogOther(record?.other);
  const fallbackTokens = toTokenNumber(fallbackValue);
  const explicitTotalInputTokens = toTokenNumber(other?.input_tokens_total);
  const inputTokens =
    explicitTotalInputTokens > 0 ? explicitTotalInputTokens : fallbackTokens;
  const cacheTokens =
    toTokenNumber(record?.cache_read_tokens) +
    toTokenNumber(record?.cache_write_tokens);

  if (inputTokens <= 0 || cacheTokens <= 0) {
    return inputTokens;
  }

  return inputTokens >= cacheTokens ? inputTokens - cacheTokens : inputTokens;
}

function getUsageLogGroupSummary(groupRatio, userGroupRatio, t) {
  const parsedUserGroupRatio = Number(userGroupRatio);
  const useUserGroupRatio =
    Number.isFinite(parsedUserGroupRatio) && parsedUserGroupRatio !== -1;
  const ratio = useUserGroupRatio ? userGroupRatio : groupRatio;
  if (ratio === undefined || ratio === null || ratio === '') {
    return '';
  }
  return `${useUserGroupRatio ? t('专属倍率') : t('分组')} ${formatRatio(ratio)}x`;
}

function renderCompactDetailSummary(summarySegments) {
  const segments = Array.isArray(summarySegments)
    ? summarySegments.filter((segment) => segment?.text)
    : [];
  if (!segments.length) {
    return null;
  }

  return (
    <div
      style={{
        maxWidth: 180,
        lineHeight: 1.35,
      }}
    >
      {segments.map((segment, index) => (
        <Typography.Text
          key={`${segment.text}-${index}`}
          type={segment.tone === 'secondary' ? 'tertiary' : undefined}
          size={segment.tone === 'secondary' ? 'small' : undefined}
          style={{
            display: 'block',
            maxWidth: '100%',
            fontSize: 12,
            marginTop: index === 0 ? 0 : 2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {segment.text}
        </Typography.Text>
      ))}
    </div>
  );
}

function getUsageLogDetailSummary(record, text, billingDisplayMode, t) {
  const other = getLogOther(record.other);

  if (record.type === 6) {
    return {
      segments: [{ text: t('异步任务退款'), tone: 'primary' }],
    };
  }

  if (other == null || record.type !== 2) {
    return null;
  }

  if (
    other?.violation_fee === true ||
    Boolean(other?.violation_fee_code) ||
    Boolean(other?.violation_fee_marker)
  ) {
    const feeQuota = other?.fee_quota ?? record?.quota;
    const groupText = getUsageLogGroupSummary(
      other?.group_ratio,
      other?.user_group_ratio,
      t,
    );
    return {
      segments: [
        groupText ? { text: groupText, tone: 'primary' } : null,
        { text: t('违规扣费'), tone: 'primary' },
        {
          text: `${t('扣费')}：${renderQuota(feeQuota, 6)}`,
          tone: 'secondary',
        },
        text ? { text: `${t('详情')}：${text}`, tone: 'secondary' } : null,
      ].filter(Boolean),
    };
  }

  return {
    segments: other?.claude
      ? renderModelPriceSimple(
          other.model_ratio,
          other.model_price,
          other.group_ratio,
          other?.user_group_ratio,
          other.cache_tokens || 0,
          other.cache_ratio || 1.0,
          other.cache_creation_tokens || 0,
          other.cache_creation_ratio || 1.0,
          other.cache_creation_tokens_5m || 0,
          other.cache_creation_ratio_5m || other.cache_creation_ratio || 1.0,
          other.cache_creation_tokens_1h || 0,
          other.cache_creation_ratio_1h || other.cache_creation_ratio || 1.0,
          false,
          1.0,
          other?.is_system_prompt_overwritten,
          'claude',
          billingDisplayMode,
          'segments',
        )
      : renderModelPriceSimple(
          other.model_ratio,
          other.model_price,
          other.group_ratio,
          other?.user_group_ratio,
          other.cache_tokens || 0,
          other.cache_ratio || 1.0,
          0,
          1.0,
          0,
          1.0,
          0,
          1.0,
          false,
          1.0,
          other?.is_system_prompt_overwritten,
          'openai',
          billingDisplayMode,
          'segments',
        ),
  };
}

export const getLogsColumns = ({
  t,
  COLUMN_KEYS,
  copyText,
  showUserInfoFunc,
  openChannelAffinityUsageCacheModal,
  isAdminUser,
  billingDisplayMode = 'price',
  showRequestDetailFunc,
}) => {
  return [
    {
      key: COLUMN_KEYS.TIME,
      title: t('时间'),
      dataIndex: 'timestamp2string',
    },
    {
      key: COLUMN_KEYS.CHANNEL,
      title: t('渠道'),
      dataIndex: 'channel',
      render: (text, record, index) => {
        let isMultiKey = false;
        let multiKeyIndex = -1;
        let content = t('渠道') + `：${record.channel}`;
        let affinity = null;
        let showMarker = false;
        let other = getLogOther(record.other);
        if (other?.admin_info) {
          let adminInfo = other.admin_info;
          if (adminInfo?.is_multi_key) {
            isMultiKey = true;
            multiKeyIndex = adminInfo.multi_key_index;
          }
          if (
            Array.isArray(adminInfo.use_channel) &&
            adminInfo.use_channel.length > 0
          ) {
            content = t('渠道') + `：${adminInfo.use_channel.join('->')}`;
          }
          if (adminInfo.channel_affinity) {
            affinity = adminInfo.channel_affinity;
            showMarker = true;
          }
        }

        return isAdminUser &&
          (record.type === 0 ||
            record.type === 2 ||
            record.type === 5 ||
            record.type === 6) ? (
          <Space>
            <span style={{ position: 'relative', display: 'inline-block' }}>
              <Tooltip content={record.channel_name || t('未知渠道')}>
                <span>
                  <Tag
                    color={colors[parseInt(text) % colors.length]}
                    shape='circle'
                  >
                    {text}
                  </Tag>
                </span>
              </Tooltip>
              {showMarker && (
                <Tooltip
                  content={
                    <div style={{ lineHeight: 1.6 }}>
                      <div>{content}</div>
                      {affinity ? (
                        <div style={{ marginTop: 6 }}>
                          {buildChannelAffinityTooltip(affinity, t)}
                        </div>
                      ) : null}
                    </div>
                  }
                >
                  <span
                    style={{
                      position: 'absolute',
                      right: -4,
                      top: -4,
                      lineHeight: 1,
                      fontWeight: 600,
                      color: '#f59e0b',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      openChannelAffinityUsageCacheModal?.(affinity);
                    }}
                  >
                    <Sparkles
                      size={14}
                      strokeWidth={2}
                      color='currentColor'
                      fill='currentColor'
                    />
                  </span>
                </Tooltip>
              )}
            </span>
            {isMultiKey && (
              <Tag color='white' shape='circle'>
                {multiKeyIndex}
              </Tag>
            )}
          </Space>
        ) : null;
      },
    },
    {
      key: COLUMN_KEYS.USERNAME,
      title: t('用户'),
      dataIndex: 'username',
      render: (text, record, index) => {
        return isAdminUser ? (
          <div>
            <Avatar
              size='extra-small'
              color={stringToColor(text)}
              style={{ marginRight: 4 }}
              onClick={(event) => {
                event.stopPropagation();
                showUserInfoFunc(record.user_id);
              }}
            >
              {typeof text === 'string' && text.slice(0, 1)}
            </Avatar>
            {text}
          </div>
        ) : (
          <></>
        );
      },
    },
    {
      key: COLUMN_KEYS.TOKEN,
      title: t('令牌'),
      dataIndex: 'token_name',
      render: (text, record, index) => {
        return record.type === 0 ||
          record.type === 2 ||
          record.type === 5 ||
          record.type === 6 ? (
          <div>
            <Tag
              color='grey'
              shape='circle'
              onClick={(event) => {
                copyText(event, text);
              }}
            >
              {' '}
              {t(text)}{' '}
            </Tag>
          </div>
        ) : (
          <></>
        );
      },
    },
    {
      key: COLUMN_KEYS.GROUP,
      title: t('分组'),
      dataIndex: 'group',
      render: (text, record, index) => {
        if (
          record.type === 0 ||
          record.type === 2 ||
          record.type === 5 ||
          record.type === 6
        ) {
          if (record.group) {
            return <>{renderGroup(record.group)}</>;
          } else {
            let other = null;
            try {
              other = JSON.parse(record.other);
            } catch (e) {
              console.error(
                `Failed to parse record.other: "${record.other}".`,
                e,
              );
            }
            if (other === null) {
              return <></>;
            }
            if (other.group !== undefined) {
              return <>{renderGroup(other.group)}</>;
            } else {
              return <></>;
            }
          }
        } else {
          return <></>;
        }
      },
    },
    {
      key: COLUMN_KEYS.TYPE,
      title: t('类型'),
      dataIndex: 'type',
      render: (text, record, index) => {
        return <>{renderType(text, t)}</>;
      },
    },
    {
      key: COLUMN_KEYS.MODEL,
      title: t('模型'),
      dataIndex: 'model_name',
      render: (text, record, index) => {
        return record.type === 0 ||
          record.type === 2 ||
          record.type === 5 ||
          record.type === 6 ? (
          <>{renderModelName(record, copyText, t)}</>
        ) : (
          <></>
        );
      },
    },
    {
      key: COLUMN_KEYS.USE_TIME,
      title: t('用时/首字'),
      dataIndex: 'use_time',
      render: (text, record, index) => {
        if (!(record.type === 2 || record.type === 5)) {
          return <></>;
        }
        const detailBtn =
          record.request_id && record.type === 5 ? (
            <Tooltip content={t('请求详情')}>
              <Button
                theme='borderless'
                type='tertiary'
                size='small'
                style={{ padding: 2, height: 'auto' }}
                icon={<FileSearch size={14} />}
                onClick={(e) => {
                  e.stopPropagation();
                  showRequestDetailFunc?.(record.request_id);
                }}
              />
            </Tooltip>
          ) : null;
        const useTime = parseInt(text);
        const completionTokens = parseInt(record.completion_tokens);
        const outTokPerSec =
          useTime > 0 && completionTokens > 0
            ? (completionTokens / useTime).toFixed(1)
            : null;
        const tokPerSecTag = outTokPerSec ? (
          <Tooltip content={t('每秒输出token数')}>
            <Tag color='blue' shape='circle'>
              {outTokPerSec} tok/s
            </Tag>
          </Tooltip>
        ) : null;

        if (record.is_stream) {
          let other = getLogOther(record.other);
          return (
            <>
              <Space>
                {renderUseTime(text, t)}
                {renderFirstUseTime(other?.frt, t)}
                {tokPerSecTag}
                {renderIsStream(record.is_stream, t, other?.stream_status)}
                {detailBtn}
              </Space>
            </>
          );
        } else {
          return (
            <>
              <Space>
                {renderUseTime(text, t)}
                {tokPerSecTag}
                {renderIsStream(record.is_stream, t)}
                {detailBtn}
              </Space>
            </>
          );
        }
      },
    },
    {
      key: COLUMN_KEYS.PROMPT,
      title: (
        <div className='flex items-center gap-1'>
          {t('输入/输出')}
          <Tooltip
            content={t(
              '第一行输入 tokens 仅展示非缓存输入；缓存读写 tokens 会在下方单独展示。',
            )}
          >
            <IconHelpCircle className='text-gray-400 cursor-help' />
          </Tooltip>
        </div>
      ),
      dataIndex: 'prompt_tokens',
      render: (text, record, index) => {
        const cacheReadTokens = record.cache_read_tokens || 0;
        const cacheWriteTokens = record.cache_write_tokens || 0;
        const inputTokens = getPrimaryInputTokens(record, text);
        const tokenDetail = buildTokenDetail(
          record,
          inputTokens,
          toTokenNumber(cacheReadTokens),
          toTokenNumber(cacheWriteTokens),
        );

        const tokenContent = (
          <div
            style={{
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              lineHeight: 1.2,
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {renderTokenValue(Upload, t('输入'), inputTokens)}
              {renderTokenValue(Download, t('输出'), record.completion_tokens)}
            </span>
            {renderCacheTokenLine(Package, t('缓存读'), cacheReadTokens)}
            {renderCacheTokenLine(SquarePen, t('缓存写'), cacheWriteTokens)}
          </div>
        );

        return record.type === 0 ||
          record.type === 2 ||
          record.type === 5 ||
          record.type === 6 ? (
          <Tooltip content={renderTokenDetailTooltip(tokenDetail, t)}>
            {tokenContent}
          </Tooltip>
        ) : (
          <></>
        );
      },
    },
    {
      key: COLUMN_KEYS.COST,
      title: t('花费'),
      dataIndex: 'quota',
      render: (text, record, index) => {
        if (
          !(
            record.type === 0 ||
            record.type === 2 ||
            record.type === 5 ||
            record.type === 6
          )
        ) {
          return <></>;
        }
        const other = getLogOther(record.other);
        const isSubscription = other?.billing_source === 'subscription';
        const costDetail = buildCostDetail(record);
        if (isSubscription) {
          // Subscription billed: show only tag (no $0), but keep tooltip for equivalent cost.
          return (
            <Tooltip content={renderCostDetailTooltip(costDetail, t)}>
              <span>{renderBillingTag(record, t)}</span>
            </Tooltip>
          );
        }
        const cacheReadQuota = record.cache_read_quota || 0;
        const cacheWriteQuota = record.cache_write_quota || 0;
        if (cacheReadQuota <= 0 && cacheWriteQuota <= 0) {
          return (
            <Tooltip content={renderCostDetailTooltip(costDetail, t)}>
              <span>{renderQuota(text, 6)}</span>
            </Tooltip>
          );
        }

        const costContent = (
          <div
            style={{
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              lineHeight: 1.2,
            }}
          >
            <span>{renderQuota(text, 6)}</span>
            {renderCacheCostLine(Package, t('缓存读消耗'), cacheReadQuota)}
            {renderCacheCostLine(SquarePen, t('缓存写花费'), cacheWriteQuota)}
          </div>
        );
        return (
          <Tooltip content={renderCostDetailTooltip(costDetail, t)}>
            {costContent}
          </Tooltip>
        );
      },
    },
    {
      key: COLUMN_KEYS.IP,
      title: (
        <div className='flex items-center gap-1'>
          {t('IP')}
          <Tooltip
            content={t(
              '只有当用户设置开启IP记录时，才会进行请求和错误类型日志的IP记录',
            )}
          >
            <IconHelpCircle className='text-gray-400 cursor-help' />
          </Tooltip>
        </div>
      ),
      dataIndex: 'ip',
      render: (text, record, index) => {
        const showIp =
          (record.type === 2 ||
            record.type === 5 ||
            (isAdminUser && record.type === 1)) &&
          text;
        return showIp ? (
          <Tooltip content={text}>
            <span>
              <Tag
                color='orange'
                shape='circle'
                onClick={(event) => {
                  copyText(event, text);
                }}
              >
                {text}
              </Tag>
            </span>
          </Tooltip>
        ) : (
          <></>
        );
      },
    },
    {
      key: COLUMN_KEYS.RETRY,
      title: t('重试'),
      dataIndex: 'retry',
      render: (text, record, index) => {
        if (!(record.type === 2 || record.type === 5)) {
          return <></>;
        }
        let content = t('渠道') + `：${record.channel}`;
        if (record.other !== '') {
          let other = JSON.parse(record.other);
          if (other === null) {
            return <></>;
          }
          if (other.admin_info !== undefined) {
            if (
              other.admin_info.use_channel !== null &&
              other.admin_info.use_channel !== undefined &&
              other.admin_info.use_channel !== ''
            ) {
              let useChannel = other.admin_info.use_channel;
              let useChannelStr = useChannel.join('->');
              content = t('渠道') + `：${useChannelStr}`;
            }
          }
        }
        return isAdminUser ? <div>{content}</div> : <></>;
      },
    },
    {
      key: COLUMN_KEYS.DETAILS,
      title: t('详情'),
      dataIndex: 'content',
      fixed: 'right',
      width: 200,
      render: (text, record, index) => {
        const detailSummary = getUsageLogDetailSummary(
          record,
          text,
          billingDisplayMode,
          t,
        );

        if (!detailSummary) {
          return (
            <Typography.Paragraph
              ellipsis={{
                rows: 2,
                showTooltip: {
                  type: 'popover',
                  opts: { style: { width: 240 } },
                },
              }}
              style={{ maxWidth: 200, marginBottom: 0 }}
            >
              {text}
            </Typography.Paragraph>
          );
        }

        return renderCompactDetailSummary(detailSummary.segments);
      },
    },
  ];
};
