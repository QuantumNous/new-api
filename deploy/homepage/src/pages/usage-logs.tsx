import { useState, useEffect, useCallback } from 'react'
import { Search } from 'lucide-react'
import { useI18n } from '../i18n'
import { api, type LogEntry, type PaginatedData } from '../lib/api'

function formatQuota(value: number): string {
  return '$' + (value / 500000).toFixed(2)
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString()
}

export function UsageLogs() {
  const { t } = useI18n()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState('')
  const [modelFilter, setModelFilter] = useState('')
  const pageSize = 20

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number | boolean | undefined> = {
        p: page,
        page_size: pageSize,
      }
      if (dateFilter) {
        params.start_timestamp = Math.floor(new Date(dateFilter).getTime() / 1000)
      }
      const res = await api.get<PaginatedData<LogEntry>>('/api/log/self', params)
      let items = res.items || []
      if (modelFilter) {
        items = items.filter(l => l.model_name.toLowerCase().includes(modelFilter.toLowerCase()))
      }
      setLogs(items)
      setTotal(res.total || 0)
    } catch {
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [page, dateFilter, modelFilter])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="usage-logs-page">
      <div className="page-header">
        <h1 className="page-title">{t('logs.title')}</h1>
      </div>

      <div className="filter-bar">
        <div className="filter-group">
          <label className="form-label">Date</label>
          <input
            className="form-input"
            type="date"
            value={dateFilter}
            onChange={(e) => { setDateFilter(e.target.value); setPage(0) }}
          />
        </div>
        <div className="filter-group">
          <label className="form-label">{t('logs.model')}</label>
          <div className="input-with-icon">
            <Search size={14} className="input-icon" />
            <input
              className="form-input has-icon"
              value={modelFilter}
              onChange={(e) => { setModelFilter(e.target.value); setPage(0) }}
              placeholder="Filter by model..."
            />
          </div>
        </div>
        <button className="btn-ghost" onClick={() => { setDateFilter(''); setModelFilter(''); setPage(0) }}>
          Clear
        </button>
      </div>

      {loading ? (
        <div className="loading-state">Loading logs...</div>
      ) : logs.length === 0 ? (
        <div className="empty-state">No log entries found.</div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('logs.time')}</th>
                  <th>{t('logs.model')}</th>
                  <th>{t('logs.token')}</th>
                  <th>{t('logs.quota')}</th>
                  <th>{t('logs.channel')}</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="mono-sm">{formatDate(log.created_at)}</td>
                    <td>
                      <span className="model-badge">{log.model_name}</span>
                    </td>
                    <td>{log.token_name}</td>
                    <td className="mono-sm">{formatQuota(log.quota)}</td>
                    <td className="mono-sm">{log.channel || '-'}</td>
                    <td className="muted-text" title={log.detail}>
                      {log.detail ? log.detail.slice(0, 80) + (log.detail.length > 80 ? '...' : '') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button className="btn-ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>
                Previous
              </button>
              <span className="pagination-info">
                {page + 1} / {totalPages}
              </span>
              <button className="btn-ghost" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                Next
              </button>
            </div>
          )}
        </>
      )}

      <style>{`
        .usage-logs-page { display: flex; flex-direction: column; gap: 20px; }

        .page-header {
          display: flex; align-items: center; justify-content: space-between;
          padding-bottom: 20px; border-bottom: 1px solid var(--line);
        }
        .page-title {
          font-family: var(--sans); font-size: 22px; font-weight: 700;
          letter-spacing: -0.02em;
        }

        .filter-bar {
          display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px;
          padding: 16px; background: var(--surface); border: 1px solid var(--line);
          border-radius: 6px;
        }
        .filter-group { display: flex; flex-direction: column; gap: 4px; }
        .form-label {
          display: block; font-family: var(--mono); font-size: 10px; font-weight: 700;
          letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted);
        }
        .form-input {
          padding: 8px 12px;
          font-family: var(--mono); font-size: 13px;
          background: var(--bg); border: 1px solid var(--line);
          border-radius: 4px; color: var(--text);
          transition: border-color 0.2s;
        }
        .form-input:focus { outline: none; border-color: var(--accent); }

        .input-with-icon { position: relative; }
        .input-icon {
          position: absolute; left: 10px; top: 50%; transform: translateY(-50%);
          color: var(--muted); pointer-events: none;
        }
        .form-input.has-icon { padding-left: 32px; }

        .btn-ghost {
          display: inline-flex; align-items: center; gap: 6px;
          font-family: var(--mono); font-size: 11px; font-weight: 500;
          border: 1px solid var(--line); border-radius: 4px;
          padding: 8px 14px; transition: all 0.2s; align-self: flex-end;
        }
        .btn-ghost:hover { border-color: var(--muted); background: var(--surface2); }
        .btn-ghost:disabled { opacity: 0.4; cursor: not-allowed; }

        .table-wrap {
          overflow-x: auto; background: var(--surface);
          border: 1px solid var(--line); border-radius: 6px;
        }
        .data-table { width: 100%; border-collapse: collapse; }
        .data-table th {
          font-family: var(--mono); font-size: 10px; font-weight: 700;
          letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted);
          text-align: left; padding: 12px 14px; border-bottom: 1px solid var(--line);
        }
        .data-table td {
          font-size: 13px; padding: 10px 14px; border-bottom: 1px solid var(--line);
          vertical-align: middle;
        }
        .data-table tr:last-child td { border-bottom: none; }
        .data-table tr:hover td { background: var(--surface2); }
        .mono-sm { font-family: var(--mono); font-size: 12px; }
        .muted-text { color: var(--muted); font-size: 12px; }

        .model-badge {
          font-family: var(--mono); font-size: 11px; font-weight: 600;
          padding: 3px 8px; border-radius: 3px;
          background: color-mix(in srgb, var(--accent2) 10%, transparent);
          color: var(--accent2);
        }

        .pagination {
          display: flex; align-items: center; justify-content: center; gap: 16px;
          padding-top: 16px;
        }
        .pagination-info {
          font-family: var(--mono); font-size: 12px; color: var(--muted);
        }

        .loading-state, .empty-state {
          padding: 48px 24px; text-align: center; color: var(--muted);
          font-family: var(--mono); font-size: 13px;
          background: var(--surface); border: 1px solid var(--line); border-radius: 6px;
        }
      `}</style>
    </div>
  )
}
