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

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { API, showError, showSuccess, renderQuota } from '../../helpers';
import {
  Card,
  Spin,
  Select,
  Switch,
  Typography,
  Tooltip,
} from '@douyinfe/semi-ui';
import { IconHandle } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  Clock,
  AlertCircle,
  Ban,
  CheckCircle2,
  Zap,
  Layers3,
  ArrowUpRight,
  SlidersHorizontal,
} from 'lucide-react';

const { Text, Title } = Typography;

function getProgressColor(pct) {
  if (pct >= 90) return 'var(--semi-color-danger)';
  if (pct >= 70) return 'var(--semi-color-warning)';
  return 'var(--semi-color-success)';
}

function StatusBadge({ status, disabled }) {
  const { t } = useTranslation();
  const pillStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    height: 28,
    padding: '0 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    lineHeight: 1,
    whiteSpace: 'nowrap',
  };
  if (disabled) {
    return (
      <span style={{ ...pillStyle, color: '#64748b', background: '#f1f5f9' }}>
        <Ban size={12} />
        {t('已禁用')}
      </span>
    );
  }
  switch (status) {
    case 'pending_activation':
      return (
        <span style={{ ...pillStyle, color: '#1d4ed8', background: '#dbeafe' }}>
          <Zap size={12} />
          {t('待激活')}
        </span>
      );
    case 'active':
      return (
        <span style={{ ...pillStyle, color: '#047857', background: '#d1fae5' }}>
          <CheckCircle2 size={12} />
          {t('使用中')}
        </span>
      );
    case 'expired':
      return (
        <span style={{ ...pillStyle, color: '#64748b', background: '#f1f5f9' }}>
          <AlertCircle size={12} />
          {t('已过期')}
        </span>
      );
    case 'cancelled':
      return (
        <span style={{ ...pillStyle, color: '#64748b', background: '#f1f5f9' }}>
          {t('已取消')}
        </span>
      );
    default:
      return (
        <span style={{ ...pillStyle, color: '#64748b', background: '#f1f5f9' }}>
          {status}
        </span>
      );
  }
}

function SoftPill({ children, tone = 'slate', title }) {
  const palette = {
    teal: {
      color: '#0f766e',
      background: 'rgba(204, 251, 241, 0.82)',
      border: 'rgba(45, 212, 191, 0.36)',
    },
    blue: {
      color: '#075985',
      background: 'rgba(224, 242, 254, 0.88)',
      border: 'rgba(125, 211, 252, 0.42)',
    },
    amber: {
      color: '#92400e',
      background: 'rgba(254, 243, 199, 0.9)',
      border: 'rgba(251, 191, 36, 0.36)',
    },
    slate: {
      color: '#334155',
      background: 'rgba(226, 232, 240, 0.82)',
      border: 'rgba(148, 163, 184, 0.32)',
    },
  }[tone];

  return (
    <span
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: 27,
        padding: '0 11px',
        borderRadius: 999,
        color: palette.color,
        background: palette.background,
        border: `1px solid ${palette.border}`,
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        boxShadow: '0 8px 18px rgba(15, 23, 42, 0.04)',
      }}
    >
      {children}
    </span>
  );
}

function DimensionTag({ plan }) {
  const { t } = useTranslation();
  if (plan?.activation_mode !== 'on_first_use') return null;
  const dv = Number(plan.duration_value);
  let label = '';
  if (plan.duration_unit === 'hour' && dv === 5) label = t('5小时');
  else if (
    plan.duration_unit === 'week' ||
    (plan.duration_unit === 'day' && dv === 7)
  )
    label = t('每周');
  else if (
    plan.duration_unit === 'month' ||
    (plan.duration_unit === 'day' && dv === 30)
  )
    label = t('每月');
  if (!label) return null;
  return <SoftPill tone='blue'>{label}</SoftPill>;
}

function HorizontalBar({ percent, color }) {
  const safePercent = Math.max(0, Math.min(Number(percent) || 0, 100));
  return (
    <div
      style={{
        height: 8,
        borderRadius: 999,
        overflow: 'hidden',
        background: 'rgba(99, 102, 241, 0.12)',
        width: '100%',
        boxShadow: 'inset 0 1px 2px rgba(15, 23, 42, 0.06)',
      }}
    >
      <div
        style={{
          height: '100%',
          borderRadius: 999,
          width: `${safePercent}%`,
          background: `linear-gradient(90deg, ${color}, ${color})`,
          transition: 'width 0.3s ease',
        }}
      />
    </div>
  );
}

function CountdownRow({ seconds, t, color }) {
  if (seconds <= 0) return null;
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d > 0) parts.push(`${d}${t('天')}`);
  if (h > 0) parts.push(`${h}${t('小时')}`);
  if (m > 0) parts.push(`${m}${t('分')}`);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        color: color || 'var(--semi-color-text-2)',
        fontSize: 12,
      }}
    >
      <Clock size={12} />
      {parts.join('')}
    </div>
  );
}

const formatDurationSeconds = (seconds, t) => {
  const tt = typeof t === 'function' ? t : (v) => v;
  const s = Number(seconds);
  if (!Number.isFinite(s) || s <= 0) return '-';
  const total = Math.floor(s);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (days > 0) return `${days}${tt('天')} ${hours}${tt('小时')}`;
  if (hours > 0) return `${hours}${tt('小时')} ${minutes}${tt('分钟')}`;
  if (minutes > 0) return `${minutes}${tt('分钟')} ${secs}${tt('秒')}`;
  return `${secs}${tt('秒')}`;
};

function SortableCard({
  subscription,
  plan,
  progress,
  windowUsage,
  onToggle,
  consumptionOrder,
}) {
  const { t } = useTranslation();
  const sub = subscription;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sub.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    height: '100%',
  };

  const activationWindowRemaining = (() => {
    if (sub.status !== 'pending_activation' || !plan?.activation_window_seconds)
      return 0;
    const elapsed = Math.floor(Date.now() / 1000) - (sub.created_at || 0);
    return Math.max(plan.activation_window_seconds - elapsed, 0);
  })();

  const timeTotal = progress?.time_total_seconds || 0;
  const timeElapsed = progress?.time_elapsed_seconds || 0;
  const timeRemaining = progress?.time_remaining_seconds || 0;
  const timePct =
    timeTotal > 0 ? Math.min((timeElapsed / timeTotal) * 100, 100) : 0;

  const quotaUsed = progress?.quota_used || 0;
  const quotaTotal = progress?.quota_total || 0;
  const quotaPct =
    quotaTotal > 0 ? Math.min((quotaUsed / quotaTotal) * 100, 100) : 0;
  const monthlyTotal = Number(
    windowUsage?.['30d']?.limit || plan?.window_limit_30d || quotaTotal || 0,
  );
  const hasWindowLimit =
    Number(plan?.window_limit_5h || 0) > 0 ||
    Number(plan?.window_limit_7d || 0) > 0 ||
    Number(plan?.window_limit_30d || 0) > 0;
  const allowedGroups = String(plan?.allowed_groups || '')
    .split(',')
    .map((group) => group.trim())
    .filter(Boolean);

  // 到期紧急度颜色
  const expiryColor = (() => {
    if (sub.status !== 'active' || !timeRemaining)
      return 'var(--semi-color-text-2)';
    const days = timeRemaining / 86400;
    if (days <= 3) return 'var(--semi-color-danger)';
    if (days <= 7) return 'var(--semi-color-warning)';
    return 'var(--semi-color-text-2)';
  })();

  const accent = (() => {
    if (sub.disabled) {
      return {
        ink: '#64748b',
        soft: '#f1f5f9',
        tint: '#f8fafc',
        glow: 'rgba(100, 116, 139, 0.14)',
        border: 'rgba(148, 163, 184, 0.26)',
      };
    }
    if (sub.status === 'pending_activation') {
      return {
        ink: '#2563eb',
        soft: '#dbeafe',
        tint: '#eff6ff',
        glow: 'rgba(37, 99, 235, 0.16)',
        border: 'rgba(59, 130, 246, 0.24)',
      };
    }
    if (sub.status !== 'active') {
      return {
        ink: '#94a3b8',
        soft: '#f1f5f9',
        tint: '#f8fafc',
        glow: 'rgba(148, 163, 184, 0.12)',
        border: 'rgba(203, 213, 225, 0.36)',
      };
    }
    return {
      ink: '#0f766e',
      soft: '#ccfbf1',
      tint: '#f0fdfa',
      glow: 'rgba(20, 184, 166, 0.16)',
      border: 'rgba(20, 184, 166, 0.24)',
    };
  })();

  const getWindowMetric = (key, label, fallbackLimit) => {
    const usage = windowUsage?.[key];
    const used = Number(windowUsage?.[key]?.used || 0);
    const limit = Number(windowUsage?.[key]?.limit || fallbackLimit || 0);
    const percent =
      limit > 0
        ? Math.min((used / limit) * 100, 100)
        : quotaTotal > 0
          ? Math.min((used / quotaTotal) * 100, 100)
          : 0;
    return {
      key,
      label,
      used,
      limit,
      percent,
      resetAfterSeconds: Number(usage?.reset_after_seconds || 0),
    };
  };

  const windowMetrics = [
    getWindowMetric('5h', t('5小时'), plan?.window_limit_5h),
    getWindowMetric('7d', t('7日'), plan?.window_limit_7d),
    getWindowMetric('30d', t('30天'), plan?.window_limit_30d),
  ];

  return (
    <div ref={setNodeRef} style={{ ...style }}>
      <Card
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 28,
          border: `1px solid ${accent.border}`,
          background: `radial-gradient(circle at 12% -10%, ${accent.soft} 0, transparent 34%), radial-gradient(circle at 92% 6%, rgba(255, 255, 255, 0.95) 0, transparent 30%), linear-gradient(145deg, ${accent.tint} 0%, #ffffff 50%, #f8fbff 100%)`,
          overflow: 'hidden',
          position: 'relative',
          boxShadow: isDragging
            ? `0 22px 54px ${accent.glow}`
            : `0 22px 54px rgba(15, 23, 42, 0.08), 0 1px 0 rgba(255, 255, 255, 0.78) inset`,
        }}
        bodyStyle={{
          padding: 0,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 30,
            right: 30,
            height: 7,
            borderRadius: '0 0 999px 999px',
            background: `linear-gradient(90deg, ${accent.ink}, rgba(20, 184, 166, 0.55))`,
            boxShadow: `0 10px 26px ${accent.glow}`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: -48,
            right: -30,
            width: 190,
            height: 190,
            borderRadius: '50%',
            background: accent.glow,
            filter: 'blur(8px)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -82,
            left: -42,
            width: 190,
            height: 190,
            borderRadius: '50%',
            background: 'rgba(14, 165, 233, 0.07)',
            filter: 'blur(6px)',
            pointerEvents: 'none',
          }}
        />
        {/* Header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto minmax(0, 1fr) auto',
            alignItems: 'center',
            gap: 14,
            padding: '26px 26px 18px',
            borderBottom: '1px solid rgba(148, 163, 184, 0.16)',
            position: 'relative',
          }}
        >
          <div
            {...attributes}
            {...listeners}
            style={{
              cursor: 'grab',
              color: accent.ink,
              width: 44,
              height: 54,
              borderRadius: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255, 255, 255, 0.78)',
              border: '1px solid rgba(255, 255, 255, 0.92)',
              boxShadow: '0 14px 32px rgba(15, 23, 42, 0.10)',
            }}
            title={t('拖拽调整消耗顺序')}
          >
            <IconHandle />
          </div>
          <div style={{ minWidth: 0 }}>
            <Text
              strong
              style={{
                display: 'block',
                marginBottom: 10,
                fontSize: 21,
                color: '#0f172a',
                letterSpacing: '-0.035em',
                lineHeight: 1.2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {plan?.title || `Plan #${sub.plan_id}`}
            </Text>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                flexWrap: 'wrap',
              }}
            >
              {monthlyTotal > 0 && (
                <SoftPill tone='blue'>
                  {t('总额度')} {renderQuota(monthlyTotal)}
                </SoftPill>
              )}
              <DimensionTag plan={plan} />
              {plan?.activation_mode === 'on_first_use' && (
                <SoftPill tone='teal'>{t('时间套餐')}</SoftPill>
              )}
              {plan?.activation_mode === 'immediate' &&
                plan?.total_amount > 0 && (
                  <SoftPill tone='amber'>{t('额度套餐')}</SoftPill>
                )}
              <Tooltip
                content={
                  allowedGroups.length > 0
                    ? `${t('支持分组')}：${allowedGroups.join(', ')}`
                    : t('支持全部分组')
                }
              >
                <span>
                  <SoftPill
                    tone='slate'
                    title={
                      allowedGroups.length > 0
                        ? `${t('支持分组')}：${allowedGroups.join(', ')}`
                        : t('支持全部分组')
                    }
                  >
                    {allowedGroups.length > 0
                      ? `${t('分组')} ${allowedGroups.join(', ')}`
                      : t('全部分组')}
                  </SoftPill>
                </span>
              </Tooltip>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexShrink: 0,
              padding: 6,
              borderRadius: 999,
              background: 'rgba(255, 255, 255, 0.58)',
              border: '1px solid rgba(255, 255, 255, 0.78)',
              boxShadow: '0 12px 30px rgba(15, 23, 42, 0.06)',
            }}
          >
            <StatusBadge status={sub.status} disabled={sub.disabled} />
            <Tooltip content={sub.disabled ? t('启用套餐') : t('临时禁用')}>
              <Switch
                size='small'
                checked={!sub.disabled}
                onChange={(checked) => onToggle(sub.id, !checked)}
                disabled={
                  sub.status === 'expired' || sub.status === 'cancelled'
                }
              />
            </Tooltip>
          </div>
        </div>

        {/* Body */}
        <div
          style={{
            padding: '24px 26px 24px',
            position: 'relative',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Pending 提示 */}
          {sub.status === 'pending_activation' && (
            <div
              style={{
                background:
                  'linear-gradient(135deg, rgba(239, 246, 255, 0.92), rgba(255, 255, 255, 0.76))',
                border: '1px solid rgba(37, 99, 235, 0.16)',
                borderRadius: 20,
                padding: '14px 16px',
                marginBottom: 16,
                boxShadow: '0 14px 30px rgba(37, 99, 235, 0.06)',
              }}
            >
              <Text style={{ fontSize: 13 }}>
                {t('首次使用 API 时将自动激活')}
              </Text>
              {activationWindowRemaining > 0 && (
                <div style={{ marginTop: 4 }}>
                  <CountdownRow
                    seconds={activationWindowRemaining}
                    t={t}
                    color='var(--semi-color-primary)'
                  />
                </div>
              )}
            </div>
          )}

          {/* 三个窗口进度条 */}
          {sub.status === 'active' && hasWindowLimit && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: 12,
                marginBottom: 22,
              }}
            >
              {windowMetrics.map((metric) => (
                <div
                  key={metric.key}
                  style={{
                    minWidth: 0,
                    borderRadius: 20,
                    padding: '14px 14px 13px',
                    background: 'rgba(255, 255, 255, 0.82)',
                    border: '1px solid rgba(148, 163, 184, 0.14)',
                    boxShadow: '0 16px 30px rgba(15, 23, 42, 0.05)',
                  }}
                >
                  <div style={{ marginBottom: 11 }}>
                    <span
                      style={{
                        display: 'block',
                        marginBottom: 6,
                        fontSize: 13,
                        fontWeight: 800,
                        color: '#0f172a',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {metric.label}
                    </span>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 12,
                        color: '#64748b',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {renderQuota(metric.used)}
                      {metric.limit > 0
                        ? ` / ${renderQuota(metric.limit)}`
                        : ''}
                    </span>
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        marginTop: 7,
                        fontSize: 11,
                        fontWeight: 700,
                        color:
                          metric.resetAfterSeconds > 0 ? '#0f766e' : '#94a3b8',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={
                        metric.resetAfterSeconds > 0
                          ? `${t('距离重置')}：${formatDurationSeconds(metric.resetAfterSeconds, t)}`
                          : t('暂无消耗，未开始重置倒计时')
                      }
                    >
                      <Clock size={12} />
                      {metric.resetAfterSeconds > 0
                        ? `${t('距离重置')} ${formatDurationSeconds(metric.resetAfterSeconds, t)}`
                        : t('暂无重置倒计时')}
                    </span>
                  </div>
                  <HorizontalBar
                    percent={metric.percent}
                    color={getProgressColor(metric.percent)}
                  />
                </div>
              ))}
            </div>
          )}

          {sub.status === 'active' && !hasWindowLimit && quotaTotal > 0 && (
            <div
              style={{
                marginBottom: 22,
                borderRadius: 20,
                padding: 16,
                background: 'rgba(255, 255, 255, 0.82)',
                border: '1px solid rgba(148, 163, 184, 0.14)',
                boxShadow: '0 16px 30px rgba(15, 23, 42, 0.05)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: '#0f172a',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t('额度消耗')}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    color: '#64748b',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {renderQuota(quotaUsed)} / {renderQuota(quotaTotal)}
                </span>
              </div>
              <HorizontalBar
                percent={quotaPct}
                color={getProgressColor(quotaPct)}
              />
            </div>
          )}

          {/* 到期时间 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 14,
              marginTop: 'auto',
              paddingTop: 2,
            }}
          >
            {sub.status === 'active' && sub.end_time > 0 ? (
              <div>
                <div
                  style={{
                    marginBottom: 4,
                    fontSize: 12,
                    color: '#64748b',
                    fontWeight: 700,
                  }}
                >
                  {t('到期')}
                </div>
                <CountdownRow
                  seconds={sub.end_time - Math.floor(Date.now() / 1000)}
                  t={t}
                  color={expiryColor}
                />
              </div>
            ) : (
              <div />
            )}

            {/* 消耗顺序 */}
            <div style={{ textAlign: 'right' }}>
              <div
                style={{
                  marginBottom: 4,
                  fontSize: 12,
                  color: '#64748b',
                  fontWeight: 700,
                }}
              >
                {t('优先级')}
              </div>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  height: 28,
                  padding: '0 12px',
                  borderRadius: 999,
                  color: consumptionOrder ? accent.ink : '#94a3b8',
                  background: consumptionOrder
                    ? 'rgba(255, 255, 255, 0.72)'
                    : 'rgba(241, 245, 249, 0.78)',
                  border: `1px solid ${consumptionOrder ? accent.border : 'rgba(203, 213, 225, 0.55)'}`,
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                {consumptionOrder
                  ? t('消耗顺序 {{order}}', { order: consumptionOrder })
                  : t('不参与消耗')}
              </span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function SubscriptionManagement() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState([]);
  const [billingPreference, setBillingPreference] =
    useState('subscription_first');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/subscription/self');
      if (res.data.success) {
        const data = res.data.data;
        setBillingPreference(data.billing_preference || 'subscription_first');
        const subs = data.usable_subscriptions || data.subscriptions || [];
        setSubscriptions(subs);
      }
    } catch (e) {
      showError(t('获取订阅信息失败'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggle = useCallback(
    async (subId, disabled) => {
      try {
        const res = await API.post(`/api/subscription/self/toggle/${subId}`, {
          disabled,
        });
        if (res.data.success) {
          showSuccess(disabled ? t('已禁用套餐') : t('已启用套餐'));
          fetchData();
        }
      } catch (e) {
        showError(t('操作失败'));
      }
    },
    [t, fetchData],
  );

  const handleChangePreference = useCallback(
    async (pref) => {
      const previous = billingPreference;
      setBillingPreference(pref);
      try {
        const res = await API.put('/api/subscription/self/preference', {
          billing_preference: pref,
        });
        if (res.data.success) {
          showSuccess(t('计费偏好已更新'));
        }
      } catch (e) {
        setBillingPreference(previous);
        showError(t('更新计费偏好失败'));
      }
    },
    [billingPreference, t],
  );

  const handleDragEnd = useCallback(
    async (event) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      setSubscriptions((items) => {
        const oldIndex = items.findIndex(
          (s) => s.subscription?.id === active.id,
        );
        const newIndex = items.findIndex((s) => s.subscription?.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return items;
        const reordered = arrayMove(items, oldIndex, newIndex);
        const ids = reordered.map((s) => s.subscription?.id).filter(Boolean);
        API.put('/api/subscription/self/priority', {
          subscription_ids: ids,
        }).catch(() => showError(t('操作失败')));
        return reordered;
      });
    },
    [t],
  );

  const sortableIds = useMemo(
    () => subscriptions.map((s) => s.subscription?.id).filter(Boolean),
    [subscriptions],
  );

  const consumptionOrderById = useMemo(() => {
    const orders = new Map();
    let order = 1;
    subscriptions.forEach((item) => {
      const sub = item.subscription;
      if (!sub) return;
      const canConsume =
        !sub.disabled &&
        (sub.status === 'active' || sub.status === 'pending_activation');
      if (!canConsume) return;
      orders.set(sub.id, order);
      order += 1;
    });
    return orders;
  }, [subscriptions]);

  const preferenceOptions = useMemo(() => {
    const hasSub = subscriptions.some(
      (s) =>
        (s.subscription?.status === 'active' ||
          s.subscription?.status === 'pending_activation') &&
        !s.subscription?.disabled,
    );
    return [
      { value: 'subscription_first', label: t('优先订阅'), disabled: !hasSub },
      { value: 'wallet_first', label: t('优先钱包') },
      { value: 'subscription_only', label: t('仅用订阅'), disabled: !hasSub },
      { value: 'wallet_only', label: t('仅用钱包') },
    ];
  }, [subscriptions, t]);

  const subscriptionSummary = useMemo(() => {
    return subscriptions.reduce(
      (summary, item) => {
        const sub = item.subscription;
        if (!sub) return summary;

        summary.total += 1;
        if (!sub.disabled && sub.status === 'active') summary.active += 1;
        const quotaTotal = Number(item.progress?.quota_total || 0);
        const quotaUsed = Number(item.progress?.quota_used || 0);
        summary.remainingQuota += Math.max(quotaTotal - quotaUsed, 0);

        return summary;
      },
      { total: 0, active: 0, remainingQuota: 0 },
    );
  }, [subscriptions]);

  if (loading) {
    return (
      <div style={{ padding: 24, display: 'flex', justifyContent: 'center' }}>
        <Spin size='large' />
      </div>
    );
  }

  return (
    <div
      style={{ maxWidth: 1280, margin: '0 auto', padding: '82px 24px 32px' }}
    >
      <Card
        bodyStyle={{ padding: 0 }}
        style={{
          marginBottom: 26,
          borderRadius: 30,
          overflow: 'hidden',
          border: '1px solid rgba(15, 23, 42, 0.08)',
          background: '#ffffff',
          boxShadow: '0 18px 45px rgba(15, 23, 42, 0.06)',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
            minHeight: 236,
          }}
        >
          <div
            style={{
              padding: '34px 36px 32px',
              borderRight: '1px solid rgba(15, 23, 42, 0.08)',
              background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 18,
                marginBottom: 30,
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: 14,
                    color: '#0f172a',
                    fontSize: 15,
                    fontWeight: 800,
                    letterSpacing: '-0.02em',
                  }}
                >
                  <Layers3 size={18} />
                  {t('订阅资产总览')}
                </div>
                <Title
                  heading={2}
                  style={{
                    margin: 0,
                    color: '#0f172a',
                    fontSize: 44,
                    lineHeight: 1.05,
                    letterSpacing: '-0.07em',
                    fontWeight: 900,
                  }}
                >
                  {t('订阅管理')}
                </Title>
              </div>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#0f172a',
                  background: '#f8fafc',
                  border: '1px solid rgba(15, 23, 42, 0.08)',
                }}
              >
                <SlidersHorizontal size={21} />
              </div>
            </div>

            <Text
              style={{
                display: 'block',
                maxWidth: 520,
                color: '#475569',
                fontSize: 16,
                lineHeight: 1.7,
                letterSpacing: '-0.02em',
              }}
            >
              {t(
                '管理可用订阅套餐、额度窗口与扣费顺序，优先使用上方套餐完成请求抵扣。',
              )}
            </Text>
          </div>

          <div style={{ display: 'grid', background: '#f8fafc', padding: 12 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateRows: '1fr 1fr 1fr',
                background: '#ffffff',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 18,
                  padding: '22px 24px',
                  borderBottom: '1px solid rgba(15, 23, 42, 0.12)',
                }}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      marginBottom: 8,
                      color: '#475569',
                      fontSize: 14,
                      fontWeight: 800,
                    }}
                  >
                    <CheckCircle2 size={16} />
                    {t('可用订阅')}
                  </div>
                  <div
                    style={{
                      color: '#0f172a',
                      fontSize: 31,
                      lineHeight: 1,
                      fontWeight: 900,
                      letterSpacing: '-0.055em',
                    }}
                  >
                    {subscriptionSummary.active}/{subscriptionSummary.total}
                  </div>
                </div>
                <ArrowUpRight size={18} style={{ color: '#cbd5e1' }} />
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 18,
                  padding: '22px 24px',
                  borderBottom: '1px solid rgba(15, 23, 42, 0.12)',
                }}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      marginBottom: 8,
                      color: '#475569',
                      fontSize: 14,
                      fontWeight: 800,
                    }}
                  >
                    <Zap size={16} />
                    {t('剩余额度')}
                  </div>
                  <div
                    style={{
                      color: '#0f172a',
                      fontSize: 31,
                      lineHeight: 1,
                      fontWeight: 900,
                      letterSpacing: '-0.055em',
                    }}
                  >
                    {renderQuota(subscriptionSummary.remainingQuota)}
                  </div>
                </div>
                <ArrowUpRight size={18} style={{ color: '#cbd5e1' }} />
              </div>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  padding: '22px 24px',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      marginBottom: 8,
                      color: '#475569',
                      fontSize: 14,
                      fontWeight: 800,
                    }}
                  >
                    <SlidersHorizontal size={16} />
                    {t('计费偏好')}
                  </div>
                  <Text
                    style={{
                      color: '#64748b',
                      fontSize: 13,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t('控制套餐与钱包余额的扣费顺序')}
                  </Text>
                </div>
                <Select
                  value={billingPreference}
                  onChange={handleChangePreference}
                  size='small'
                  style={{ width: 190 }}
                  optionList={preferenceOptions}
                />
              </div>
            </div>
          </div>
        </div>
      </Card>

      {subscriptions.length === 0 ? (
        <Card bodyStyle={{ padding: 40, textAlign: 'center' }}>
          <GripVertical
            size={32}
            style={{ color: 'var(--semi-color-text-3)', marginBottom: 8 }}
          />
          <Text type='tertiary'>{t('暂无订阅套餐')}</Text>
        </Card>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortableIds}
            strategy={verticalListSortingStrategy}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(min(100%, 420px), 1fr))',
                gap: 22,
                alignItems: 'stretch',
              }}
            >
              {subscriptions
                .filter((item) => item.subscription)
                .map((item) => {
                  const sub = item.subscription;
                  const plan = item.plan;
                  const progress = item.progress;
                  const windowUsage = item.window_usage;
                  return (
                    <SortableCard
                      key={sub?.id}
                      subscription={sub}
                      plan={plan}
                      progress={progress}
                      windowUsage={windowUsage}
                      onToggle={handleToggle}
                      consumptionOrder={consumptionOrderById.get(sub?.id)}
                    />
                  );
                })}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
