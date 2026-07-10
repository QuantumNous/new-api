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
import { subscriptionWindowLimitDefinitions } from '../../helpers/subscriptionFormat';

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
    height: 24,
    padding: '0 9px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    lineHeight: 1,
    whiteSpace: 'nowrap',
    border: '1px solid transparent',
  };
  if (disabled) {
    return (
      <span
        style={{
          ...pillStyle,
          color: 'var(--console-text-muted)',
          background: 'var(--semi-color-fill-0)',
          borderColor: 'var(--console-border)',
        }}
      >
        <Ban size={12} />
        {t('已禁用')}
      </span>
    );
  }
  switch (status) {
    case 'pending_activation':
      return (
        <span
          style={{
            ...pillStyle,
            color: '#1d4ed8',
            background: 'rgba(219, 234, 254, 0.72)',
            borderColor: 'rgba(59, 130, 246, 0.18)',
          }}
        >
          <Zap size={12} />
          {t('待激活')}
        </span>
      );
    case 'active':
      return (
        <span
          style={{
            ...pillStyle,
            color: '#047857',
            background: 'rgba(209, 250, 229, 0.72)',
            borderColor: 'rgba(16, 185, 129, 0.18)',
          }}
        >
          <CheckCircle2 size={12} />
          {t('使用中')}
        </span>
      );
    case 'expired':
      return (
        <span
          style={{
            ...pillStyle,
            color: 'var(--console-text-muted)',
            background: 'var(--semi-color-fill-0)',
            borderColor: 'var(--console-border)',
          }}
        >
          <AlertCircle size={12} />
          {t('已过期')}
        </span>
      );
    case 'cancelled':
      return (
        <span
          style={{
            ...pillStyle,
            color: 'var(--console-text-muted)',
            background: 'var(--semi-color-fill-0)',
            borderColor: 'var(--console-border)',
          }}
        >
          {t('已取消')}
        </span>
      );
    default:
      return (
        <span
          style={{
            ...pillStyle,
            color: 'var(--console-text-muted)',
            background: 'var(--semi-color-fill-0)',
            borderColor: 'var(--console-border)',
          }}
        >
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
  if (d > 0) parts.push(`${d}${t('天_short')}`);
  if (h > 0 || d > 0) parts.push(`${h}${t('小时_short')}`);
  if (m > 0 || (d === 0 && h === 0)) parts.push(`${m}${t('分钟_short')}`);
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
      {parts.join(' ')}
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
  const parts = [];
  if (days > 0) {
    parts.push(`${days}${tt('天_short')}`);
    parts.push(`${hours}${tt('小时_short')}`);
  } else if (hours > 0) {
    parts.push(`${hours}${tt('小时_short')}`);
    parts.push(`${minutes}${tt('分钟_short')}`);
  } else if (minutes > 0) {
    parts.push(`${minutes}${tt('分钟_short')}`);
    parts.push(`${secs}${tt('秒_short')}`);
  } else {
    parts.push(`${secs}${tt('秒_short')}`);
  }
  return parts.join(' ');
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
        glow: 'rgba(100, 116, 139, 0.10)',
        border: 'rgba(148, 163, 184, 0.26)',
      };
    }
    if (sub.status === 'pending_activation') {
      return {
        ink: '#2563eb',
        soft: '#dbeafe',
        tint: '#eff6ff',
        glow: 'rgba(37, 99, 235, 0.10)',
        border: 'rgba(59, 130, 246, 0.24)',
      };
    }
    if (sub.status !== 'active') {
      return {
        ink: '#94a3b8',
        soft: '#f1f5f9',
        tint: '#f8fafc',
        glow: 'rgba(148, 163, 184, 0.08)',
        border: 'rgba(203, 213, 225, 0.36)',
      };
    }
    return {
      ink: '#0f766e',
      soft: '#ccfbf1',
      tint: '#f0fdfa',
      glow: 'rgba(20, 184, 166, 0.10)',
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

  const windowMetrics = subscriptionWindowLimitDefinitions
    .map((item) =>
      getWindowMetric(item.key, item.getLabel(t), plan?.[item.field]),
    )
    .filter((metric) => metric.limit > 0);
  const hasWindowLimit = windowMetrics.length > 0;
  const quotaDisplayTotal = Number(
    quotaTotal || windowMetrics[windowMetrics.length - 1]?.limit || 0,
  );

  return (
    <div ref={setNodeRef} style={{ ...style }}>
      <Card
        className='subscription-self-card'
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 24,
          border: `1px solid ${accent.border}`,
          background: 'var(--console-card-bg)',
          overflow: 'hidden',
          position: 'relative',
          boxShadow: isDragging
            ? `0 18px 44px ${accent.glow}`
            : 'var(--console-shadow-card)',
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
            left: 0,
            right: 0,
            height: 3,
            borderRadius: '0 0 999px 999px',
            background: accent.ink,
            opacity: 0.72,
          }}
        />
        {/* Header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto minmax(0, 1fr) auto',
            alignItems: 'center',
            gap: 14,
            padding: '24px 24px 18px',
            borderBottom: '1px solid var(--console-border)',
            position: 'relative',
          }}
        >
          <div
            {...attributes}
            {...listeners}
            style={{
              cursor: 'grab',
              color: accent.ink,
              width: 34,
              height: 34,
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--console-card-muted-bg)',
              border: '1px solid var(--console-border)',
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
                color: 'var(--console-text-strong)',
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
              {quotaDisplayTotal > 0 && (
                <SoftPill tone='blue'>
                  {t('总额度')} {renderQuota(quotaDisplayTotal)}
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
              gap: 8,
              flexShrink: 0,
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
                  'linear-gradient(135deg, rgba(59, 130, 246, 0.14), var(--console-glass-bg))',
                border: '1px solid rgba(37, 99, 235, 0.16)',
                borderRadius: 20,
                padding: '14px 16px',
                marginBottom: 16,
                boxShadow: 'var(--console-shadow-card)',
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

          {/* 窗口进度条 */}
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
                    background: 'var(--console-glass-bg)',
                    border: '1px solid var(--console-border)',
                    boxShadow: 'var(--console-shadow-card)',
                  }}
                >
                  <div style={{ marginBottom: 11 }}>
                    <span
                      style={{
                        display: 'block',
                        marginBottom: 6,
                        fontSize: 13,
                        fontWeight: 800,
                        color: 'var(--console-text-strong)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {metric.label}
                    </span>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 12,
                        color: 'var(--console-text-muted)',
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
                          metric.resetAfterSeconds > 0
                            ? 'var(--semi-color-success)'
                            : 'var(--console-text-muted)',
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
                background: 'var(--console-glass-bg)',
                border: '1px solid var(--console-border)',
                boxShadow: 'var(--console-shadow-card)',
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
                    color: 'var(--console-text-strong)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t('额度消耗')}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    color: 'var(--console-text-muted)',
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
                    color: 'var(--console-text-muted)',
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
                  color: 'var(--console-text-muted)',
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
                  color: consumptionOrder
                    ? accent.ink
                    : 'var(--console-text-muted)',
                  background: consumptionOrder
                    ? 'var(--console-glass-bg)'
                    : 'var(--semi-color-fill-0)',
                  border: `1px solid ${consumptionOrder ? accent.border : 'var(--console-border)'}`,
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
    <div className='wallet-page console-finance-command-page console-command-center topup-command-center w-full relative min-h-screen lg:min-h-0 mt-[60px]'>
      <div className='console-dashboard-orb console-dashboard-orb-teal' />
      <div className='console-dashboard-orb console-dashboard-orb-blue' />
      <div className='console-dashboard-orb console-dashboard-orb-amber' />
      <div className='console-finance-command-content'>
        <Card
          bodyStyle={{ padding: 0 }}
          className='console-finance-hero-card'
          style={{
            marginBottom: 26,
            borderRadius: 30,
            overflow: 'hidden',
            border: '1px solid var(--console-border)',
            background: 'var(--console-card-bg)',
            boxShadow: 'var(--console-shadow)',
          }}
        >
          <div
            className='console-finance-hero-grid'
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
              minHeight: 236,
            }}
          >
            <div
              className='console-finance-hero-main'
              style={{
                padding: '34px 36px 32px',
                borderRight: '1px solid var(--console-border)',
                background: 'var(--console-card-gradient)',
              }}
            >
              <div
                className='console-finance-hero-head'
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
                    className='console-finance-hero-eyebrow'
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      marginBottom: 14,
                      color: 'var(--console-text-strong)',
                      fontSize: 15,
                      fontWeight: 800,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    <Layers3 size={18} />
                    {t('订阅资产总览')}
                  </div>
                  <Title
                    className='console-finance-hero-title'
                    heading={2}
                    style={{
                      margin: 0,
                      color: 'var(--console-text-strong)',
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
                  className='console-finance-hero-icon'
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--console-text-strong)',
                    background: 'var(--console-icon-bg)',
                    border: '1px solid var(--console-border)',
                  }}
                >
                  <SlidersHorizontal size={21} />
                </div>
              </div>

              <Text
                className='console-finance-hero-desc'
                style={{
                  display: 'block',
                  maxWidth: 520,
                  color: 'var(--console-text)',
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

            <div
              className='console-finance-hero-metrics'
              style={{
                display: 'grid',
                background: 'var(--console-card-muted-bg)',
                padding: 12,
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateRows: '1fr 1fr 1fr',
                  background: 'var(--console-card-bg)',
                }}
              >
                <div
                  className='console-finance-hero-metric-row'
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 18,
                    padding: '22px 24px',
                    borderBottom: '1px solid var(--console-border-strong)',
                  }}
                >
                  <div>
                    <div
                      className='console-finance-hero-metric-label'
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 9,
                        marginBottom: 8,
                        color: 'var(--console-text)',
                        fontSize: 14,
                        fontWeight: 800,
                      }}
                    >
                      <CheckCircle2 size={16} />
                      {t('可用订阅')}
                    </div>
                    <div
                      className='console-finance-hero-metric-value'
                      style={{
                        color: 'var(--console-text-strong)',
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
                  className='console-finance-hero-metric-row'
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 18,
                    padding: '22px 24px',
                    borderBottom: '1px solid var(--console-border-strong)',
                  }}
                >
                  <div>
                    <div
                      className='console-finance-hero-metric-label'
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 9,
                        marginBottom: 8,
                        color: 'var(--console-text)',
                        fontSize: 14,
                        fontWeight: 800,
                      }}
                    >
                      <Zap size={16} />
                      {t('剩余额度')}
                    </div>
                    <div
                      className='console-finance-hero-metric-value'
                      style={{
                        color: 'var(--console-text-strong)',
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
                  className='console-finance-hero-metric-row'
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
                      className='console-finance-hero-metric-label'
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 9,
                        marginBottom: 8,
                        color: 'var(--console-text)',
                        fontSize: 14,
                        fontWeight: 800,
                      }}
                    >
                      <SlidersHorizontal size={16} />
                      {t('计费偏好')}
                    </div>
                    <Text
                      style={{
                        color: 'var(--console-text-muted)',
                        fontSize: 13,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {t('控制套餐与钱包余额的扣费顺序')}
                    </Text>
                  </div>
                  <Select
                    className='subscription-billing-preference-select'
                    value={billingPreference}
                    onChange={handleChangePreference}
                    size='default'
                    style={{ width: 230 }}
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
    </div>
  );
}
