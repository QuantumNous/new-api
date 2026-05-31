import { useState, useEffect, useCallback } from 'react'
import { useI18n } from '../i18n'
import { api, type PaginatedData } from '../lib/api'

/* ---- types ---- */
interface RedemptionCode {
  id: number
  key: string
  status: number
  quota: number
  created_time: number
  used_user_id: number
  redeemed_time: number
}

const STATUS_LABELS: Record<number, string> = {
  1: 'Unused',
  2: 'Disabled',
  3: 'Redeemed',
}

function formatQuota(quota: number) {
  return (quota / 500000).toFixed(2)
}

function formatTime(ts: number) {
  if (!ts) return '-'
  return new Date(ts * 1000).toLocaleString()
}

function maskKey(key: string) {
  if (!key) return '-'
  if (key.length <= 8) return key
  return key.slice(0, 4) + '****' + key.slice(-4)
}

/* ---- form state ---- */
interface RedemptionForm {
  count: number
  quota: number
}

const EMPTY_FORM: RedemptionForm = { count: 1, quota: 500000 }

export function RedemptionCodes() {
  const { t } = useI18n()

  const [codes, setCodes] = useState<RedemptionCode[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  /* modal */
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<RedemptionForm>({ ...EMPTY_FORM })
  const [submitting, setSubmitting] = useState(false)

  /* ---- fetch ---- */
  const fetchCodes = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get<PaginatedData<RedemptionCode>>('/api/redemption/', {
        p: page,
        page_size: 20,
      })
      setCodes(res.items ?? [])
      setTotal(res.total ?? 0)
    } catch (e: any) {
      setError(e.message || 'Failed to load redemption codes')
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { fetchCodes() }, [fetchCodes])

  const totalPages = Math.ceil(total / 20)

  /* ---- handlers ---- */
  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      await api.post('/api/redemption/', { count: form.count, quota: form.quota })
      setModalOpen(false)
      fetchCodes()
    } catch (e: any) {
      alert(e.message || 'Operation failed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this redemption code?')) return
    try {
      await api.del('/api/redemption/' + id)
      fetchCodes()
    } catch (e: any) {
      alert(e.message || 'Delete failed')
    }
  }

  const handleDeleteInvalid = async () => {
    if (!confirm('Delete all invalid / redeemed codes?')) return
    try {
      await api.del('/api/redemption/invalid')
      setPage(1)
      fetchCodes()
    } catch (e: any) {
      alert(e.message || 'Delete failed')
    }
  }

  /* ---- render ---- */
  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">{t('redemptions.title')}</h1>
        <div className="page-actions">
          <button className="btn-danger btn-ghost-sm" onClick={handleDeleteInvalid}>
            {t('redemptions.deleteInvalid')}
          </button>
          <button className="btn-primary" onClick={() => { setForm({ ...EMPTY_FORM }); setModalOpen(true) }}>
            + {t('redemptions.create')}
          </button>
        </div>
      </div>

      {error && <div className="page-error">{error}</div>}

      {loading ? (
        <div className="page-loading"><div className="spinner" /></div>
      ) : (
        <>
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>{t('redemptions.key')}</th>
                <th>{t('redemptions.status')}</th>
                <th>{t('redemptions.quota')}</th>
                <th>Created</th>
                <th>Redeemed By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {codes.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center' }}>No redemption codes found</td></tr>
              ) : codes.map((code) => (
                <tr key={code.id}>
                  <td>{code.id}</td>
                  <td style={{ fontFamily: 'var(--mono)' }}>{maskKey(code.key)}</td>
                  <td>
                    <span className={`status-badge status-${code.status}`}>
                      {STATUS_LABELS[code.status] || code.status}
                    </span>
                  </td>
                  <td>{formatQuota(code.quota)}</td>
                  <td>{formatTime(code.created_time)}</td>
                  <td>{code.used_user_id || '-'}</td>
                  <td>
                    <div className="action-btns">
                      <button className="btn-danger btn-ghost-sm" onClick={() => handleDelete(code.id)}>
                        {t('redemptions.delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="pagination">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
              <span>Page {page} of {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          )}
        </>
      )}

      {/* Create Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('redemptions.create')}</h2>
              <button className="btn-ghost-sm" onClick={() => setModalOpen(false)}>X</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Count</label>
                <input className="form-input" type="number" min={1} value={form.count}
                  onChange={(e) => setForm({ ...form, count: Number(e.target.value) })} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('redemptions.quota')}</label>
                <input className="form-input" type="number" value={form.quota}
                  onChange={(e) => setForm({ ...form, quota: Number(e.target.value) })} />
                <span style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4, display: 'block' }}>
                  Display value: {formatQuota(form.quota)}
                </span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost-sm" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn-primary" disabled={submitting} onClick={handleSubmit}>
                {submitting ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
