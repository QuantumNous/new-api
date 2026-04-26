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
import { Tooltip } from '@heroui/react';
import { CircleAlert, HelpCircle, Route, Sparkles } from 'lucide-react';
import HoverPanel from '@/components/common/ui/HoverPanel';
import {
  getLogOther,
  renderGroup,
  renderModelPriceSimple,
  renderModelTag,
  renderQuota,
  stringToColor,
} from '../../../helpers';

// ---------- Tailwind primitives (mirrors TaskLogs/MjLogs to keep tone parity) ----------
const TONE_TO_HEX = {
  amber: '#f59e0b',
  blue: '#3b82f6',
  cyan: '#06b6d4',
  green: '#22c55e',
  grey: '#94a3b8',
  indigo: '#6366f1',
  'light-blue': '#0ea5e9',
  lime: '#84cc16',
  orange: '#f97316',
  pink: '#ec4899',
  purple: '#a855f7',
  red: '#ef4444',
  teal: '#14b8a6',
  violet: '#8b5cf6',
  yellow: '#eab308',
  white: '#ffffff',
};

const TAG_PALETTE_KEYS = [
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

function ColorTag({ color = 'grey', prefixIcon, children, onClick, title }) {
  const hex = TONE_TO_HEX[color] || TONE_TO_HEX.grey;
  if (color === 'white') {
    return (
      <span
        title={title}
        onClick={onClick}
        className={`inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-xs font-medium text-foreground ${
          onClick ? 'cursor-pointer' : ''
        }`}
      >
        {prefixIcon}
        {children}
      </span>
    );
  }
  return (
    <span
      title={title}
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        onClick ? 'cursor-pointer' : ''
      }`}
      style={{
        backgroundColor: `${hex}1A`,
        color: hex,
      }}
    >
      {prefixIcon}
      {children}
    </span>
  );
}

function UserChip({ name, onClick }) {
  const safeName = typeof name === 'string' ? name : '';
  const tone = stringToColor(safeName) || 'grey';
  const hex = TONE_TO_HEX[tone] || TONE_TO_HEX.grey;
  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center gap-2 ${onClick ? 'cursor-pointer' : ''}`}
    >
      <span
        className='flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold'
        style={{
          background: `${hex}26`,
          color: hex,
        }}
      >
        {safeName.slice(0, 1).toUpperCase()}
      </span>
      <span className='text-sm text-foreground'>{safeName}</span>
    </span>
  );
}

function EllipsisText({ children, width = 200, rows = 2 }) {
  // Best-effort substitute for Semi's `Typography.Paragraph ellipsis`:
  // line-clamp the text and surface the full string in a hover tooltip.
  const stringValue =
    typeof children === 'string' ? children : String(children ?? '');
  return (
    <Tooltip content={stringValue} placement='top'>
      <span
        className='inline-block align-top text-xs text-foreground'
        style={{
          maxWidth: width,
          display: '-webkit-box',
          WebkitLineClamp: rows,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          whiteSpace: 'normal',
          wordBreak: 'break-word',
        }}
      >
        {stringValue}
      </span>
    </Tooltip>
  );
}

// ---------- Utility helpers ported from the original implementation ----------
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
  if (!affinity) return null;
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
    <div className='flex flex-col gap-1 text-xs leading-snug'>
      {lines.map((line, i) => (
        <div key={i}>{line}</div>
      ))}
    </div>
  );
}

function buildStreamStatusTooltip(ss, t) {
  if (!ss) return null;
  const lines = [
    t('流状态') + '：' + t('异常'),
    ss.end_reason || 'unknown',
  ];
  if (ss.error_count > 0) {
    lines.push(`${t('软错误')}: ${ss.error_count}`);
  }
  if (ss.end_error) {
    lines.push(ss.end_error);
  }
  return (
    <div className='flex flex-col gap-1 text-xs leading-snug'>
      {lines.map((line, i) => (
        <div key={i}>{line}</div>
      ))}
    </div>
  );
}

// ---------- Primitive renderers ----------
function renderType(type, t) {
  switch (type) {
    case 1:
      return <ColorTag color='cyan'>{t('充值')}</ColorTag>;
    case 2:
      return <ColorTag color='lime'>{t('消费')}</ColorTag>;
    case 3:
      return <ColorTag color='orange'>{t('管理')}</ColorTag>;
    case 4:
      return <ColorTag color='purple'>{t('系统')}</ColorTag>;
    case 5:
      return <ColorTag color='red'>{t('错误')}</ColorTag>;
    case 6:
      return <ColorTag color='teal'>{t('退款')}</ColorTag>;
    default:
      return <ColorTag color='grey'>{t('未知')}</ColorTag>;
  }
}

function renderIsStream(bool, t, streamStatus) {
  const isError = streamStatus && streamStatus.status !== 'ok';
  if (bool) {
    return (
      <span className='relative inline-block'>
        <ColorTag color='blue'>{t('流')}</ColorTag>
        {isError ? (
          <Tooltip content={buildStreamStatusTooltip(streamStatus, t)}>
            <span
              className='absolute -right-1 -top-1 cursor-pointer select-none leading-none text-red-500'
              aria-label='stream status error'
            >
              <CircleAlert size={14} strokeWidth={2.5} color='currentColor' />
            </span>
          </Tooltip>
        ) : null}
      </span>
    );
  }
  return <ColorTag color='purple'>{t('非流')}</ColorTag>;
}

function renderUseTime(value) {
  const time = parseInt(value);
  let color = 'green';
  if (time >= 300) color = 'red';
  else if (time >= 101) color = 'orange';
  return <ColorTag color={color}>{time} s</ColorTag>;
}

function renderFirstUseTime(value) {
  let time = parseFloat(value) / 1000.0;
  time = time.toFixed(1);
  let color = 'green';
  if (time >= 10) color = 'red';
  else if (time >= 3) color = 'orange';
  return <ColorTag color={color}>{time} s</ColorTag>;
}

function renderBillingTag(record, t) {
  const other = getLogOther(record.other);
  if (other?.billing_source === 'subscription') {
    return <ColorTag color='green'>{t('订阅抵扣')}</ColorTag>;
  }
  return null;
}

function renderModelName(record, copyText, t) {
  const other = getLogOther(record.other);
  const modelMapped =
    other?.is_model_mapped &&
    other?.upstream_model_name &&
    other?.upstream_model_name !== '';

  if (!modelMapped) {
    return renderModelTag(record.model_name, {
      onClick: (event) => {
        copyText(event, record.model_name).then(() => {});
      },
    });
  }

  const popoverContent = (
    <div className='flex flex-col gap-2 p-1 text-xs'>
      <div className='flex items-center gap-2'>
        <span className='font-semibold text-foreground'>
          {t('请求并计费模型')}:
        </span>
        {renderModelTag(record.model_name, {
          onClick: (event) => {
            copyText(event, record.model_name).then(() => {});
          },
        })}
      </div>
      <div className='flex items-center gap-2'>
        <span className='font-semibold text-foreground'>{t('实际模型')}:</span>
        {renderModelTag(other.upstream_model_name, {
          onClick: (event) => {
            copyText(event, other.upstream_model_name).then(() => {});
          },
        })}
      </div>
    </div>
  );

  return (
    <HoverPanel content={popoverContent} placement='top'>
      <span className='inline-flex items-center'>
        {renderModelTag(record.model_name, {
          onClick: (event) => {
            copyText(event, record.model_name).then(() => {});
          },
          suffixIcon: (
            <Route style={{ width: '0.9em', height: '0.9em', opacity: 0.75 }} />
          ),
        })}
      </span>
    </HoverPanel>
  );
}

// ---------- Token / cache helpers (unchanged behaviour) ----------
function toTokenNumber(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return parsed;
}

function formatTokenCount(value) {
  return toTokenNumber(value).toLocaleString();
}

function getPromptCacheSummary(other) {
  if (!other || typeof other !== 'object') return null;

  const cacheReadTokens = toTokenNumber(other.cache_tokens);
  const cacheCreationTokens = toTokenNumber(other.cache_creation_tokens);
  const cacheCreationTokens5m = toTokenNumber(other.cache_creation_tokens_5m);
  const cacheCreationTokens1h = toTokenNumber(other.cache_creation_tokens_1h);

  const hasSplitCacheCreation =
    cacheCreationTokens5m > 0 || cacheCreationTokens1h > 0;
  const cacheWriteTokens = hasSplitCacheCreation
    ? cacheCreationTokens5m + cacheCreationTokens1h
    : cacheCreationTokens;

  if (cacheReadTokens <= 0 && cacheWriteTokens <= 0) {
    return null;
  }

  return { cacheReadTokens, cacheWriteTokens };
}

function getUsageLogGroupSummary(groupRatio, userGroupRatio, t) {
  const parsedUserGroupRatio = Number(userGroupRatio);
  const useUserGroupRatio =
    Number.isFinite(parsedUserGroupRatio) && parsedUserGroupRatio !== -1;
  const ratio = useUserGroupRatio ? userGroupRatio : groupRatio;
  if (ratio === undefined || ratio === null || ratio === '') return '';
  return `${useUserGroupRatio ? t('专属倍率') : t('分组')} ${formatRatio(ratio)}x`;
}

function renderCompactDetailSummary(summarySegments) {
  const segments = Array.isArray(summarySegments)
    ? summarySegments.filter((segment) => segment?.text)
    : [];
  if (!segments.length) return null;

  return (
    <div
      className='flex flex-col gap-0.5'
      style={{ maxWidth: 180, lineHeight: 1.35 }}
    >
      {segments.map((segment, index) => {
        const muted = segment.tone === 'secondary';
        return (
          <span
            key={`${segment.text}-${index}`}
            className={`block max-w-full truncate ${muted ? 'text-[11px] text-muted' : 'text-xs text-foreground'}`}
          >
            {segment.text}
          </span>
        );
      })}
    </div>
  );
}

function getUsageLogDetailSummary(record, text, billingDisplayMode, t) {
  const other = getLogOther(record.other);

  if (record.type === 6) {
    return { segments: [{ text: t('异步任务退款'), tone: 'primary' }] };
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

// ---------- Column factory ----------
export const getLogsColumns = ({
  t,
  COLUMN_KEYS,
  copyText,
  showUserInfoFunc,
  openChannelAffinityUsageCacheModal,
  isAdminUser,
  billingDisplayMode = 'price',
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
      render: (text, record) => {
        let isMultiKey = false;
        let multiKeyIndex = -1;
        let content = t('渠道') + `：${record.channel}`;
        let affinity = null;
        let showMarker = false;
        const other = getLogOther(record.other);
        if (other?.admin_info) {
          const adminInfo = other.admin_info;
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

        if (
          !isAdminUser ||
          !(
            record.type === 0 ||
            record.type === 2 ||
            record.type === 5 ||
            record.type === 6
          )
        ) {
          return null;
        }

        const tagColor =
          TAG_PALETTE_KEYS[parseInt(text) % TAG_PALETTE_KEYS.length];

        return (
          <div className='inline-flex items-center gap-1.5'>
            <span className='relative inline-block'>
              <Tooltip content={record.channel_name || t('未知渠道')}>
                <span>
                  <ColorTag color={tagColor}>{text}</ColorTag>
                </span>
              </Tooltip>
              {showMarker ? (
                <Tooltip
                  content={
                    <div className='flex flex-col gap-1 text-xs leading-snug'>
                      <div>{content}</div>
                      {affinity ? (
                        <div className='mt-1'>
                          {buildChannelAffinityTooltip(affinity, t)}
                        </div>
                      ) : null}
                    </div>
                  }
                >
                  <span
                    className='absolute -right-1 -top-1 cursor-pointer select-none leading-none font-semibold text-amber-500'
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
              ) : null}
            </span>
            {isMultiKey ? (
              <ColorTag color='white'>{multiKeyIndex}</ColorTag>
            ) : null}
          </div>
        );
      },
    },
    {
      key: COLUMN_KEYS.USERNAME,
      title: t('用户'),
      dataIndex: 'username',
      render: (text, record) => {
        if (!isAdminUser) return null;
        return (
          <UserChip
            name={text}
            onClick={(event) => {
              event.stopPropagation();
              showUserInfoFunc(record.user_id);
            }}
          />
        );
      },
    },
    {
      key: COLUMN_KEYS.TOKEN,
      title: t('令牌'),
      dataIndex: 'token_name',
      render: (text, record) => {
        if (
          !(
            record.type === 0 ||
            record.type === 2 ||
            record.type === 5 ||
            record.type === 6
          )
        ) {
          return null;
        }
        return (
          <ColorTag
            color='grey'
            onClick={(event) => copyText(event, text)}
          >
            {t(text)}
          </ColorTag>
        );
      },
    },
    {
      key: COLUMN_KEYS.GROUP,
      title: t('分组'),
      dataIndex: 'group',
      render: (text, record) => {
        if (
          !(
            record.type === 0 ||
            record.type === 2 ||
            record.type === 5 ||
            record.type === 6
          )
        ) {
          return null;
        }
        if (record.group) {
          return <>{renderGroup(record.group)}</>;
        }
        let other = null;
        try {
          other = JSON.parse(record.other);
        } catch (e) {
          console.error(
            `Failed to parse record.other: "${record.other}".`,
            e,
          );
        }
        if (other === null) return null;
        if (other.group !== undefined) {
          return <>{renderGroup(other.group)}</>;
        }
        return null;
      },
    },
    {
      key: COLUMN_KEYS.TYPE,
      title: t('类型'),
      dataIndex: 'type',
      render: (text) => renderType(text, t),
    },
    {
      key: COLUMN_KEYS.MODEL,
      title: t('模型'),
      dataIndex: 'model_name',
      render: (text, record) => {
        if (
          !(
            record.type === 0 ||
            record.type === 2 ||
            record.type === 5 ||
            record.type === 6
          )
        ) {
          return null;
        }
        return renderModelName(record, copyText, t);
      },
    },
    {
      key: COLUMN_KEYS.USE_TIME,
      title: t('用时/首字'),
      dataIndex: 'use_time',
      render: (text, record) => {
        if (!(record.type === 2 || record.type === 5)) return null;
        const other = getLogOther(record.other);
        return (
          <div className='inline-flex items-center gap-1'>
            {renderUseTime(text)}
            {record.is_stream ? renderFirstUseTime(other?.frt) : null}
            {renderIsStream(record.is_stream, t, other?.stream_status)}
          </div>
        );
      },
    },
    {
      key: COLUMN_KEYS.PROMPT,
      title: (
        <div className='flex items-center gap-1'>
          {t('输入')}
          <Tooltip
            content={t(
              '根据 Anthropic 协定，/v1/messages 的输入 tokens 仅统计非缓存输入，不包含缓存读取与缓存写入 tokens。',
            )}
          >
            <HelpCircle size={12} className='cursor-help text-muted' />
          </Tooltip>
        </div>
      ),
      dataIndex: 'prompt_tokens',
      render: (text, record) => {
        if (
          !(
            record.type === 0 ||
            record.type === 2 ||
            record.type === 5 ||
            record.type === 6
          )
        ) {
          return null;
        }
        const other = getLogOther(record.other);
        const cacheSummary = getPromptCacheSummary(other);
        const hasCacheRead = (cacheSummary?.cacheReadTokens || 0) > 0;
        const hasCacheWrite = (cacheSummary?.cacheWriteTokens || 0) > 0;
        let cacheText = '';
        if (hasCacheRead && hasCacheWrite) {
          cacheText = `${t('缓存读')} ${formatTokenCount(cacheSummary.cacheReadTokens)} · ${t('写')} ${formatTokenCount(cacheSummary.cacheWriteTokens)}`;
        } else if (hasCacheRead) {
          cacheText = `${t('缓存读')} ${formatTokenCount(cacheSummary.cacheReadTokens)}`;
        } else if (hasCacheWrite) {
          cacheText = `${t('缓存写')} ${formatTokenCount(cacheSummary.cacheWriteTokens)}`;
        }

        return (
          <div className='inline-flex flex-col items-start leading-tight'>
            <span className='text-sm text-foreground'>{text}</span>
            {cacheText ? (
              <span className='mt-0.5 whitespace-nowrap text-[11px] text-muted'>
                {cacheText}
              </span>
            ) : null}
          </div>
        );
      },
    },
    {
      key: COLUMN_KEYS.COMPLETION,
      title: t('输出'),
      dataIndex: 'completion_tokens',
      render: (text, record) => {
        if (
          !(parseInt(text) > 0) ||
          !(
            record.type === 0 ||
            record.type === 2 ||
            record.type === 5 ||
            record.type === 6
          )
        ) {
          return null;
        }
        return <span className='text-sm text-foreground'>{text}</span>;
      },
    },
    {
      key: COLUMN_KEYS.COST,
      title: t('花费'),
      dataIndex: 'quota',
      render: (text, record) => {
        if (
          !(
            record.type === 0 ||
            record.type === 2 ||
            record.type === 5 ||
            record.type === 6
          )
        ) {
          return null;
        }
        const other = getLogOther(record.other);
        const isSubscription = other?.billing_source === 'subscription';
        if (isSubscription) {
          return (
            <Tooltip content={`${t('由订阅抵扣')}：${renderQuota(text, 6)}`}>
              <span>{renderBillingTag(record, t)}</span>
            </Tooltip>
          );
        }
        return <>{renderQuota(text, 6)}</>;
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
            <HelpCircle size={12} className='cursor-help text-muted' />
          </Tooltip>
        </div>
      ),
      dataIndex: 'ip',
      render: (text, record) => {
        const showIp =
          (record.type === 2 ||
            record.type === 5 ||
            (isAdminUser && record.type === 1)) &&
          text;
        if (!showIp) return null;
        return (
          <Tooltip content={text}>
            <span>
              <ColorTag
                color='orange'
                onClick={(event) => copyText(event, text)}
              >
                {text}
              </ColorTag>
            </span>
          </Tooltip>
        );
      },
    },
    {
      key: COLUMN_KEYS.RETRY,
      title: t('重试'),
      dataIndex: 'retry',
      render: (text, record) => {
        if (!(record.type === 2 || record.type === 5)) return null;
        let content = t('渠道') + `：${record.channel}`;
        if (record.other !== '') {
          let other = null;
          try {
            other = JSON.parse(record.other);
          } catch (_) {
            return null;
          }
          if (other === null) return null;
          if (other.admin_info !== undefined) {
            const useChannel = other.admin_info.use_channel;
            if (
              useChannel !== null &&
              useChannel !== undefined &&
              useChannel !== ''
            ) {
              content = t('渠道') + `：${useChannel.join('->')}`;
            }
          }
        }
        return isAdminUser ? <div>{content}</div> : null;
      },
    },
    {
      key: COLUMN_KEYS.DETAILS,
      title: t('详情'),
      dataIndex: 'content',
      fixed: 'right',
      width: 200,
      render: (text, record) => {
        const detailSummary = getUsageLogDetailSummary(
          record,
          text,
          billingDisplayMode,
          t,
        );
        if (!detailSummary) {
          return <EllipsisText width={200} rows={2}>{text}</EllipsisText>;
        }
        return renderCompactDetailSummary(detailSummary.segments);
      },
    },
  ];
};
