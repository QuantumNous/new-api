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

const pageSizeOptions = [20, 50, 100];

const SubscriptionUsageView = ({ t, viewType = 'plan' }) => {
  const [loading, setLoading] = useState(false);
  const [planUsage, setPlanUsage] = useState([]);
  const [inactiveUsers, setInactiveUsers] = useState([]);
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'));
  const [days, setDays] = useState(15);
  const [groupFilter, setGroupFilter] = useState('');
  const [usernameFilter, setUsernameFilter] = useState('');
  const [planIdFilter, setPlanIdFilter] = useState('');
  const [groupOptions, setGroupOptions] = useState([{ label: t('全部分组'), value: '' }]);
  const [planOptions, setPlanOptions] = useState([{ label: t('全部套餐'), value: '' }]);

  const [planPage, setPlanPage] = useState(1);
  const [planPageSize, setPlanPageSize] = useState(20);
  const [planTotal, setPlanTotal] = useState(0);

  const [inactivePage, setInactivePage] = useState(1);
  const [inactivePageSize, setInactivePageSize] = useState(20);
  const [inactiveTotal, setInactiveTotal] = useState(0);

  const loadFilterOptions = async () => {
    try {
      const [groupsRes, plansRes] = await Promise.all([
        API.get('/api/group/'),
        API.get('/api/subscription/admin/plans'),
      ]);
      const nextGroups = (groupsRes.data?.data || []).map((g) => ({ label: g, value: g }));
      setGroupOptions([{ label: t('全部分组'), value: '' }, ...nextGroups]);

      const nextPlans = (plansRes.data?.data || [])
        .map((p) => ({
          label: p?.plan?.title || `${t('套餐')} #${p?.plan?.id}`,
          value: String(p?.plan?.id || ''),
        }))
        .filter((p) => p.value !== '');
      setPlanOptions([{ label: t('全部套餐'), value: '' }, ...nextPlans]);
    } catch {
      setGroupOptions([{ label: t('全部分组'), value: '' }]);
      setPlanOptions([{ label: t('全部套餐'), value: '' }]);
    }
  };

  const loadPlanUsage = async (targetPage = planPage, targetPageSize = planPageSize) => {
    setLoading(true);
    try {
      const planRes = await API.get('/api/subscription/admin/plan-usage', {
        params: {
          p: targetPage,
          page_size: targetPageSize,
          month,
          group: groupFilter,
          username: usernameFilter.trim(),
          plan_id: planIdFilter ? Number(planIdFilter) : undefined,
        },
      });
      if (planRes.data?.success) {
        const pageData = planRes.data?.data || {};
        setPlanUsage(pageData.items || []);
        setPlanTotal(pageData.total || 0);
        setPlanPage(pageData.page || targetPage);
        setPlanPageSize(pageData.page_size || targetPageSize);
      } else {
        showError(planRes.data?.message || t('加载失败'));
      }
    } catch (e) {
      showError(e.message || t('加载失败'));
    } finally {
      setLoading(false);
    }
  };

  const loadInactiveUsers = async (targetPage = inactivePage, targetPageSize = inactivePageSize) => {
    setLoading(true);
    try {
      const inactiveRes = await API.get('/api/subscription/admin/inactive-users', {
        params: {
          days,
          p: targetPage,
          page_size: targetPageSize,
        },
      });
      if (inactiveRes.data?.success) {
        const pageData = inactiveRes.data?.data || {};
        setInactiveUsers(pageData.items || []);
        setInactiveTotal(pageData.total || 0);
        setInactivePage(pageData.page || targetPage);
        setInactivePageSize(pageData.page_size || targetPageSize);
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
      loadFilterOptions();
      loadPlanUsage(1, planPageSize);
      return;
    }
    loadInactiveUsers(1, inactivePageSize);
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

  const renderPager = ({ page, pageSize, total, onPageChange, onPageSizeChange }) => {
    const totalPage = Math.max(1, Math.ceil((total || 0) / (pageSize || 1)));
    return (
      <div
        style={{
          marginTop: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ color: 'var(--semi-color-text-2)', fontSize: 12 }}>
          {t('共 {{count}} 条', { count: total || 0 })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value || 20))}
            style={{
              border: '1px solid var(--semi-color-border)',
              borderRadius: 8,
              padding: '6px 8px',
              background: 'var(--semi-color-bg-0)',
            }}
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size} / {t('页')}
              </option>
            ))}
          </select>
          <button
            className='semi-button semi-button-tertiary semi-button-size-small'
            disabled={loading || page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            {t('上一页')}
          </button>
          <span style={{ fontSize: 12, color: 'var(--semi-color-text-1)', minWidth: 74, textAlign: 'center' }}>
            {page} / {totalPage}
          </span>
          <button
            className='semi-button semi-button-tertiary semi-button-size-small'
            disabled={loading || page >= totalPage}
            onClick={() => onPageChange(page + 1)}
          >
            {t('下一页')}
          </button>
        </div>
      </div>
    );
  };

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
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value || '')}
              style={{
                width: 160,
                border: '1px solid var(--semi-color-border)',
                borderRadius: 8,
                padding: '7px 10px',
                background: 'var(--semi-color-bg-0)',
              }}
            >
              {groupOptions.map((g) => (
                <option key={g.value || '__all'} value={g.value}>{g.label}</option>
              ))}
            </select>
            <select
              value={planIdFilter}
              onChange={(e) => setPlanIdFilter(e.target.value || '')}
              style={{
                width: 180,
                border: '1px solid var(--semi-color-border)',
                borderRadius: 8,
                padding: '7px 10px',
                background: 'var(--semi-color-bg-0)',
              }}
            >
              {planOptions.map((p) => (
                <option key={p.value || '__all'} value={p.value}>{p.label}</option>
              ))}
            </select>
            <input
              value={usernameFilter}
              onChange={(e) => setUsernameFilter(e.target.value || '')}
              placeholder={t('按用户名筛选')}
              style={{
                width: 180,
                border: '1px solid var(--semi-color-border)',
                borderRadius: 8,
                padding: '7px 10px',
                background: 'var(--semi-color-bg-0)',
              }}
            />
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
              onClick={() => loadPlanUsage(1, planPageSize)}
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
                <th style={thStyle}>{t('总量')}</th>
              </tr>
            </thead>
            <tbody>
              {planUsage.length === 0
                ? (
                  <tr>
                    <td colSpan={6}>{renderEmpty(t('暂无套餐用量数据'))}</td>
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
                      <td style={tdStyle}>{renderQuota(row.amount_total || 0)}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {renderPager({
          page: planPage,
          pageSize: planPageSize,
          total: planTotal,
          onPageChange: (nextPage) => loadPlanUsage(nextPage, planPageSize),
          onPageSizeChange: (nextPageSize) => loadPlanUsage(1, nextPageSize),
        })}
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
            className='semi-button semi-button-tertiary semi-button-size-small'
            onClick={async () => {
              try {
                const res = await API.get('/api/subscription/admin/inactive-users/export', {
                  params: { days },
                  responseType: 'blob',
                });
                const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `inactive-users-${days}days-${new Date().toISOString().split('T')[0]}.csv`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
              } catch (e) {
                showError(e.message || t('导出失败'));
              }
            }}
            disabled={loading}
          >
            {t('导出 CSV')}
          </button>
          <button
            className='semi-button semi-button-primary semi-button-size-small'
            onClick={() => loadInactiveUsers(1, inactivePageSize)}
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
                    <td style={tdStyle}>{row.last_login_at || '-'}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {renderPager({
        page: inactivePage,
        pageSize: inactivePageSize,
        total: inactiveTotal,
        onPageChange: (nextPage) => loadInactiveUsers(nextPage, inactivePageSize),
        onPageSizeChange: (nextPageSize) => loadInactiveUsers(1, nextPageSize),
      })}
    </div>
  );
};

export default SubscriptionUsageView;
