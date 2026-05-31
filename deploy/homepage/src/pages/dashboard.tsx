import { useState, useEffect } from 'react'
import { Activity, DollarSign, Zap, BarChart3 } from 'lucide-react'
import { useI18n } from '../i18n'
import { useAuth } from '../lib/auth'
import { api, type LogEntry, type PaginatedData } from '../lib/api'

function formatQuota(value: number): string {
  return '$' + (value / 500000).toFixed(2)
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString()
}

export function Dashboard() {
  const { t } = useI18n()
  const { user, refresh } = useAuth()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    refresh()
    api.get<PaginatedData<LogEntry>>('/api/log/self', { p: 0, page_size: 10 })
      .then((res) => setLogs(res.items || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const totalQuota = (user?.quota ?? 0) + (user?.used_quota ?? 0)
  const quotaUsedPercent = totalQuota > 0
    ? Math.min(((user?.used_quota ?? 0) / totalQuota) * 100, 100)
    : 0

  const recentUsage = logs.slice(0, 7)
  const maxQuota = Math.max(...recentUsage.map(l => l.quota), 1)

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <h1 className="page-title">{t('dashboard.title')}</h1>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-card-icon">
            <DollarSign size={18} />
          </div>
          <div className="metric-card-value">{formatQuota(totalQuota)}</div>
          <div className="metric-card-label">{t('dashboard.totalQuota')}</div>
        </div>
        <div className="metric-card">
          <div className="metric-card-icon accent2">
            <Activity size={18} />
          </div>
          <div className="metric-card-value">{formatQuota(user?.used_quota ?? 0)}</div>
          <div className="metric-card-label">{t('dashboard.usedQuota')}</div>
        </div>
        <div className="metric-card">
          <div className="metric-card-icon warn">
            <Zap size={18} />
          </div>
          <div className="metric-card-value">{user?.request_count ?? 0}</div>
          <div className="metric-card-label">{t('dashboard.requests')}</div>
        </div>
        <div className="metric-card">
          <div className="metric-card-icon">
            <BarChart3 size={18} />
          </div>
          <div className="metric-card-value">{formatQuota(user?.quota ?? 0)}</div>
          <div className="metric-card-label">Balance</div>
        </div>
      </div>

      <div className="page-section">
        <h2 className="section-subtitle">Usage Overview</h2>
        <div className="usage-chart">
          <div className="chart-bar-container">
            {recentUsage.map((entry, i) => (
              <div key={entry.id || i} className="chart-bar-wrapper">
                <div
                  className="chart-bar"
                  style={{ height: `${Math.max((entry.quota / maxQuota) * 100, 4)}%` }}
                />
                <div className="chart-bar-label">
                  {new Date(entry.created_at * 1000).toLocaleDateString(undefined, { weekday: 'short' })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="quota-progress">
          <div className="quota-progress-header">
            <span>Quota Used</span>
            <span>{quotaUsedPercent.toFixed(1)}%</span>
          </div>
          <div className="quota-progress-track">
            <div className="quota-progress-fill" style={{ width: `${quotaUsedPercent}%` }} />
          </div>
        </div>
      </div>

      <div className="page-section">
        <h2 className="section-subtitle">{t('dashboard.recentLogs')}</h2>
        {loading ? (
          <div className="loading-state">Loading logs...</div>
        ) : logs.length === 0 ? (
          <div className="empty-state">No recent logs found.</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('logs.time')}</th>
                  <th>{t('logs.model')}</th>
                  <th>{t('logs.token')}</th>
                  <th>{t('logs.quota')}</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="mono-sm">{formatDate(log.created_at)}</td>
                    <td>{log.model_name}</td>
                    <td>{log.token_name}</td>
                    <td className="mono-sm">{formatQuota(log.quota)}</td>
                    <td className="muted-text" title={log.detail}>
                      {log.detail ? log.detail.slice(0, 60) + (log.detail.length > 60 ? '...' : '') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        .dashboard-page { display: flex; flex-direction: column; gap: 28px; }

        .page-header {
          display: flex; align-items: center; justify-content: space-between;
          padding-bottom: 20px; border-bottom: 1px solid var(--line);
        }
        .page-title {
          font-family: var(--sans); font-size: 22px; font-weight: 700;
          letter-spacing: -0.02em;
        }

        .metric-grid {
          display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;
        }
        @media (min-width: 768px) { .metric-grid { grid-template-columns: repeat(4, 1fr); } }

        .metric-card {
          background: var(--surface); border: 1px solid var(--line);
          border-radius: 6px; padding: 20px;
          transition: border-color 0.2s;
        }
        .metric-card:hover { border-color: var(--muted); }

        .metric-card-icon {
          width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
          border-radius: 4px; background: color-mix(in srgb, var(--accent) 12%, transparent);
          color: var(--accent); margin-bottom: 12px;
        }
        .metric-card-icon.accent2 { background: color-mix(in srgb, var(--accent2) 12%, transparent); color: var(--accent2); }
        .metric-card-icon.warn { background: color-mix(in srgb, var(--warn, #ffb020) 12%, transparent); color: var(--warn, #ffb020); }

        .metric-card-value {
          font-family: var(--mono); font-size: 24px; font-weight: 700;
          color: var(--text);
        }
        .metric-card-label {
          font-family: var(--mono); font-size: 11px; font-weight: 500;
          letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted);
          margin-top: 4px;
        }

        .page-section {
          background: var(--surface); border: 1px solid var(--line);
          border-radius: 6px; padding: 20px;
        }
        .section-subtitle {
          font-family: var(--mono); font-size: 13px; font-weight: 700;
          letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted);
          margin-bottom: 16px;
        }

        .usage-chart { margin-bottom: 20px; }
        .chart-bar-container {
          display: flex; align-items: flex-end; gap: 8px; height: 120px;
          padding: 0 4px;
        }
        .chart-bar-wrapper {
          flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%;
          justify-content: flex-end;
        }
        .chart-bar {
          width: 100%; min-height: 4px;
          background: linear-gradient(180deg, var(--accent), color-mix(in srgb, var(--accent) 40%, transparent));
          border-radius: 3px 3px 0 0;
          transition: height 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .chart-bar-label {
          font-family: var(--mono); font-size: 9px; color: var(--muted);
          margin-top: 6px; text-transform: uppercase;
        }

        .quota-progress { margin-top: 8px; }
        .quota-progress-header {
          display: flex; justify-content: space-between;
          font-family: var(--mono); font-size: 11px; color: var(--muted);
          margin-bottom: 6px;
        }
        .quota-progress-track {
          height: 6px; border-radius: 3px; background: var(--surface2);
          overflow: hidden;
        }
        .quota-progress-fill {
          height: 100%; border-radius: 3px;
          background: var(--accent);
          transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .table-wrap { overflow-x: auto; }
        .data-table { width: 100%; border-collapse: collapse; }
        .data-table th {
          font-family: var(--mono); font-size: 10px; font-weight: 700;
          letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted);
          text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--line);
        }
        .data-table td {
          font-size: 13px; padding: 10px 12px; border-bottom: 1px solid var(--line);
          vertical-align: middle;
        }
        .data-table tr:last-child td { border-bottom: none; }
        .data-table tr:hover td { background: var(--surface2); }
        .mono-sm { font-family: var(--mono); font-size: 12px; }
        .muted-text { color: var(--muted); font-size: 12px; }

        .loading-state, .empty-state {
          padding: 32px; text-align: center; color: var(--muted);
          font-family: var(--mono); font-size: 13px;
        }
      `}</style>
    </div>
  )
}
