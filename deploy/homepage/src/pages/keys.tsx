import { useState, useEffect, useCallback } from 'react'
import { Plus, Copy, Trash2, ToggleLeft, ToggleRight, X } from 'lucide-react'
import { useI18n } from '../i18n'
import { api, type Token, type PaginatedData } from '../lib/api'

function formatQuota(value: number): string {
  return '$' + (value / 500000).toFixed(2)
}

function formatDate(ts: number): string {
  if (!ts) return '-'
  return new Date(ts * 1000).toLocaleString()
}

function maskKey(key: string): string {
  const bareKey = key.startsWith('sk-') ? key.slice(3) : key
  if (!bareKey) return '-'
  if (bareKey.includes('*')) return 'sk-' + bareKey
  if (bareKey.length <= 8) return 'sk-' + bareKey
  return 'sk-' + bareKey.slice(0, 4) + '****' + bareKey.slice(-4)
}

function formatFullKey(key: string): string {
  if (!key) return ''
  return key.startsWith('sk-') ? key : 'sk-' + key
}

type TokenKeyResponse = { key: string }

export function Keys() {
  const { t } = useI18n()
  const [tokens, setTokens] = useState<Token[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copiedId, setCopiedId] = useState<number | null>(null)

  const [form, setForm] = useState({
    name: '',
    remain_quota: 0,
    expired_time: -1,
    models: '',
    group: '',
  })

  const pageSize = 20

  const fetchTokens = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<PaginatedData<Token>>('/api/token/', { p: page, page_size: pageSize })
      setTokens(res.items || [])
      setTotal(res.total || 0)
    } catch {
      setTokens([])
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { fetchTokens() }, [fetchTokens])

  const handleCreate = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      await api.post('/api/token/', {
        name: form.name,
        remain_quota: form.remain_quota * 500000,
        expired_time: form.expired_time === -1 ? -1 : Math.floor(new Date(form.expired_time).getTime() / 1000),
        models: form.models,
        group: form.group,
      })
      setShowModal(false)
      setForm({ name: '', remain_quota: 0, expired_time: -1, models: '', group: '' })
      fetchTokens()
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this token?')) return
    try {
      await api.del('/api/token/' + id)
      fetchTokens()
    } catch (err) {
      alert((err as Error).message)
    }
  }

  const handleToggleStatus = async (token: Token) => {
    const newStatus = token.status === 1 ? 2 : 1
    try {
      await api.put('/api/token/', { id: token.id, status: newStatus, name: token.name, remain_quota: token.remain_quota, expired_time: token.expired_time, unlimited_quota: token.unlimited_quota, models: token.models, subnet: token.subnet, group: token.group })
      fetchTokens()
    } catch (err) {
      alert((err as Error).message)
    }
  }

  const handleCopy = async (id: number) => {
    try {
      const res = await api.post<TokenKeyResponse>('/api/token/' + id + '/key')
      const fullKey = formatFullKey(res.key)
      if (!fullKey) throw new Error('Empty token key')
      await navigator.clipboard.writeText(fullKey)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (err) {
      alert((err as Error).message)
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="keys-page">
      <div className="page-header">
        <h1 className="page-title">{t('keys.title')}</h1>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={14} /> {t('keys.create')}
        </button>
      </div>

      {loading ? (
        <div className="loading-state">Loading tokens...</div>
      ) : tokens.length === 0 ? (
        <div className="empty-state">
          <p>No API tokens found.</p>
          <button className="btn-primary" onClick={() => setShowModal(true)} style={{ marginTop: 12 }}>
            <Plus size={14} /> {t('keys.create')}
          </button>
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('keys.name')}</th>
                  <th>{t('keys.key')}</th>
                  <th>{t('keys.status')}</th>
                  <th>{t('keys.quota')}</th>
                  <th>Created</th>
                  <th>{t('keys.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((token) => (
                  <tr key={token.id}>
                    <td className="td-name">{token.name}</td>
                    <td className="mono-sm">
                      <div className="key-cell">
                        <code>{maskKey(token.key)}</code>
                        <button className="btn-icon" onClick={() => handleCopy(token.id)} title={t('keys.copy')}>
                          <Copy size={13} />
                          {copiedId === token.id && <span className="copied-badge">Copied</span>}
                        </button>
                      </div>
                    </td>
                    <td>
                      <button className="btn-icon status-toggle" onClick={() => handleToggleStatus(token)} title="Toggle status">
                        {token.status === 1
                          ? <ToggleRight size={20} style={{ color: 'var(--accent)' }} />
                          : <ToggleLeft size={20} style={{ color: 'var(--danger)' }} />
                        }
                      </button>
                    </td>
                    <td className="mono-sm">
                      {token.unlimited_quota ? 'Unlimited' : formatQuota(token.remain_quota)}
                    </td>
                    <td className="mono-sm">{formatDate(token.created_time)}</td>
                    <td>
                      <button className="btn-icon btn-danger-icon" onClick={() => handleDelete(token.id)} title={t('keys.delete')}>
                        <Trash2 size={14} />
                      </button>
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

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('keys.create')}</h2>
              <button className="btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>

            <div className="form-group">
              <label className="form-label">{t('keys.name')}</label>
              <input
                className="form-input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="My API Token"
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t('common.quotaUsd')}</label>
              <input
                className="form-input"
                type="number"
                value={form.remain_quota}
                onChange={(e) => setForm({ ...form, remain_quota: Number(e.target.value) })}
                placeholder="0"
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t('common.expiredTime')}</label>
              <input
                className="form-input"
                type="datetime-local"
                onChange={(e) => setForm({ ...form, expired_time: e.target.value ? Number(new Date(e.target.value).getTime() / 1000) : -1 })}
              />
              <span className="form-hint">{t('common.neverExpireHint')}</span>
            </div>

            <div className="form-group">
              <label className="form-label">{t('channels.models')}</label>
              <input
                className="form-input"
                value={form.models}
                onChange={(e) => setForm({ ...form, models: e.target.value })}
                placeholder={t('common.allModelsHint')}
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t('common.group')}</label>
              <input
                className="form-input"
                value={form.group}
                onChange={(e) => setForm({ ...form, group: e.target.value })}
                placeholder="default"
              />
            </div>

            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShowModal(false)}>{t('common.cancel')}</button>
              <button className="btn-primary" onClick={handleCreate} disabled={saving || !form.name.trim()}>
                {saving ? 'Creating...' : t('keys.create')}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .keys-page { display: flex; flex-direction: column; gap: 20px; }

        .page-header {
          display: flex; align-items: center; justify-content: space-between;
          padding-bottom: 20px; border-bottom: 1px solid var(--line);
        }
        .page-title {
          font-family: var(--sans); font-size: 22px; font-weight: 700;
          letter-spacing: -0.02em;
        }

        .btn-primary {
          display: inline-flex; align-items: center; gap: 6px;
          font-family: var(--mono); font-size: 11px; font-weight: 700;
          letter-spacing: 0.04em; text-transform: uppercase;
          border-radius: 4px; padding: 9px 16px;
          background: var(--accent); color: var(--bg);
          transition: all 0.2s;
        }
        .btn-primary:hover { box-shadow: 0 0 20px color-mix(in srgb, var(--accent) 30%, transparent); }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

        .btn-ghost {
          display: inline-flex; align-items: center; gap: 6px;
          font-family: var(--mono); font-size: 11px; font-weight: 500;
          border: 1px solid var(--line); border-radius: 4px;
          padding: 8px 14px; transition: all 0.2s;
        }
        .btn-ghost:hover { border-color: var(--muted); background: var(--surface2); }
        .btn-ghost:disabled { opacity: 0.4; cursor: not-allowed; }

        .btn-icon {
          display: inline-flex; align-items: center; gap: 4px;
          background: none; border: none; color: var(--muted);
          padding: 4px; border-radius: 3px; cursor: pointer;
          transition: color 0.15s;
        }
        .btn-icon:hover { color: var(--text); }
        .btn-danger-icon:hover { color: var(--danger); }

        .table-wrap { overflow-x: auto; background: var(--surface); border: 1px solid var(--line); border-radius: 6px; }
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

        .td-name { font-weight: 600; }
        .mono-sm { font-family: var(--mono); font-size: 12px; }

        .key-cell { display: flex; align-items: center; gap: 6px; }
        .key-cell code { font-family: var(--mono); font-size: 12px; }
        .copied-badge {
          font-family: var(--mono); font-size: 9px; font-weight: 700;
          color: var(--accent); text-transform: uppercase;
        }

        .status-toggle { padding: 2px; }

        .pagination {
          display: flex; align-items: center; justify-content: center; gap: 16px;
          padding-top: 16px;
        }
        .pagination-info {
          font-family: var(--mono); font-size: 12px; color: var(--muted);
        }

        .modal-overlay {
          position: fixed; inset: 0; z-index: 200;
          background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          padding: 24px;
        }
        .modal {
          background: var(--surface); border: 1px solid var(--line);
          border-radius: 8px; padding: 24px; width: 100%; max-width: 480px;
          max-height: 90vh; overflow-y: auto;
        }
        .modal-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 20px;
        }
        .modal-header h2 {
          font-family: var(--mono); font-size: 15px; font-weight: 700;
          letter-spacing: 0.02em; text-transform: uppercase;
        }
        .modal-actions {
          display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;
          padding-top: 16px; border-top: 1px solid var(--line);
        }

        .form-group { margin-bottom: 14px; }
        .form-label {
          display: block; font-family: var(--mono); font-size: 11px; font-weight: 700;
          letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted);
          margin-bottom: 6px;
        }
        .form-input {
          width: 100%; padding: 9px 12px;
          font-family: var(--mono); font-size: 13px;
          background: var(--bg); border: 1px solid var(--line);
          border-radius: 4px; color: var(--text);
          transition: border-color 0.2s;
        }
        .form-input:focus { outline: none; border-color: var(--accent); }
        .form-hint {
          display: block; font-size: 11px; color: var(--muted); margin-top: 4px;
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
