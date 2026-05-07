import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { API, renderQuota, showError } from '../../../helpers';

const panelStyle = {
  background: 'var(--semi-color-bg-1)',
  border: '1px solid var(--semi-color-border)',
  borderRadius: 12,
  padding: 16,
};

const thStyle = {
  textAlign: 'left',
  padding: '10px 8px',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--semi-color-text-1)',
  background: 'var(--semi-color-fill-0)',
  borderBottom: '1px solid var(--semi-color-border)',
  whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '10px 8px',
  fontSize: 13,
  color: 'var(--semi-color-text-0)',
  borderBottom: '1px solid var(--semi-color-border)',
  whiteSpace: 'nowrap',
};

const SubscriptionUsageView = ({ t, viewType = 'plan' }) => {
  const [loading, setLoading] = useState(false);
  const [planUsage, setPlanUsage] = useState([]);
  const [inactiveUsers, setInactiveUsers] = useState([]);
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'));
  const [days, setDays] = useState(15);

  const loadPlanUsage = async () => {
    setLoading(true);
    try {
      const planRes = await API.get('/api/subscription/admin/plan-usage', {
        params: {
          p: 1,
          page_size: 100,
          month,
        },
      });
      if (planRes.data?.success) {
        setPlanUsage(planRes.data?.data?.items || []);
      } else {
        showError(planRes.data?.message || t('加载失败'));
      }
    } catch (e) {
      showError(e.message || t('加载失败'));
    } finally {
      setLoading(false);
    }
  };

  const loadInactiveUsers = async () => {
    setLoading(true);
    try {
      const inactiveRes = await API.get('/api/subscription/admin/inactive-users', {
        params: {
          days,
          p: 1,
          page_size: 100,
        },
      });
      if (inactiveRes.data?.success) {
        setInactiveUsers(inactiveRes.data?.data?.items || []);
      } else {
        showError(inactiveRes.data?.message || t('加载失败'));
      }
    } catch (e) {
      showError(e.message || t('加载失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (viewType === 'plan') {
      loadPlanUsage();
      return;
    }
    loadInactiveUsers();
  }, [viewType]);

  const inactiveDayOptions = useMemo(
    () => [
      { label: t('最近7天'), value: 7 },
      { label: t('最近15天'), value: 15 },
      { label: t('最近30天'), value: 30 },
      { label: t('最近60天'), value: 60 },
      { label: t('最近90天'), value: 90 },
    ],
    [t],
  );

  const renderEmpty = (text) => (
    <div
      style={{
        padding: '28px 12px',
        textAlign: 'center',
        color: 'var(--semi-color-text-2)',
        fontSize: 13,
      }}
    >
      {text}
    </div>
  );

  if (viewType === 'plan') {
    return (
      <div style={panelStyle}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600 }}>{t('套餐用量')}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type='month'
              value={month}
              onChange={(e) => setMonth(e.target.value || dayjs().format('YYYY-MM'))}
              style={{
                width: 180,
                border: '1px solid var(--semi-color-border)',
                borderRadius: 8,
                padding: '7px 10px',
                background: 'var(--semi-color-bg-0)',
              }}
            />
            <button
              className='semi-button semi-button-primary semi-button-size-small'
              onClick={loadPlanUsage}
              disabled={loading}
            >
              {loading ? t('加载中') : t('查询套餐用量')}
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--semi-color-border)' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr>
                <th style={thStyle}>User</th>
                <th style={thStyle}>{t('显示名')}</th>
                <th style={thStyle}>{t('分组')}</th>
                <th style={thStyle}>{t('套餐')}</th>
                <th style={thStyle}>{t('本月用量')}</th>
                <th style={thStyle}>{t('累计已用')}</th>
                <th style={thStyle}>{t('总量')}</th>
              </tr>
            </thead>
            <tbody>
              {planUsage.length === 0
                ? (
                  <tr>
                    <td colSpan={7}>{renderEmpty(t('暂无套餐用量数据'))}</td>
                  </tr>
                )
                : planUsage.map((row, idx) => (
                    <tr
                      key={`${row.user_id}-${row.plan_id || 0}`}
                      style={{ background: idx % 2 === 0 ? 'var(--semi-color-bg-0)' : 'var(--semi-color-fill-0)' }}
                    >
                      <td style={tdStyle}>{row.username || '-'}</td>
                      <td style={tdStyle}>{row.display_name || '-'}</td>
                      <td style={tdStyle}>{row.user_group || '-'}</td>
                      <td style={tdStyle}>{row.plan_title || '-'}</td>
                      <td style={tdStyle}>{renderQuota(row.month_used || 0)}</td>
                      <td style={tdStyle}>{renderQuota(row.amount_used || 0)}</td>
                      <td style={tdStyle}>{renderQuota(row.amount_total || 0)}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div style={panelStyle}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600 }}>{t('非活跃用户')}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value || 15))}
            style={{
              width: 180,
              border: '1px solid var(--semi-color-border)',
              borderRadius: 8,
              padding: '7px 10px',
              background: 'var(--semi-color-bg-0)',
            }}
          >
            {inactiveDayOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            className='semi-button semi-button-primary semi-button-size-small'
            onClick={loadInactiveUsers}
            disabled={loading}
          >
            {loading ? t('加载中') : t('查询非活跃用户')}
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--semi-color-border)' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              <th style={thStyle}>User</th>
              <th style={thStyle}>{t('显示名')}</th>
              <th style={thStyle}>{t('分组')}</th>
              <th style={thStyle}>{t('组织')}</th>
              <th style={thStyle}>{t('最近Token使用')}</th>
            </tr>
          </thead>
          <tbody>
            {inactiveUsers.length === 0
              ? (
                <tr>
                  <td colSpan={5}>{renderEmpty(t('暂无非活跃用户数据'))}</td>
                </tr>
              )
              : inactiveUsers.map((row, idx) => (
                  <tr
                    key={row.user_id}
                    style={{ background: idx % 2 === 0 ? 'var(--semi-color-bg-0)' : 'var(--semi-color-fill-0)' }}
                  >
                    <td style={tdStyle}>{row.username || '-'}</td>
                    <td style={tdStyle}>{row.display_name || '-'}</td>
                    <td style={tdStyle}>{row.user_group || '-'}</td>
                    <td style={tdStyle}>{row.org_name || '-'}</td>
                    <td style={tdStyle}>{row.last_token_used_at || '-'}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SubscriptionUsageView;
