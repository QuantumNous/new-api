import { useState, useEffect, useCallback } from 'react'
import { useI18n } from '../i18n'
import { api, type Channel, type PaginatedData } from '../lib/api'

/* ---- channel type map ---- */
const CHANNEL_TYPES: Record<number, string> = {
  1: 'OpenAI',
  3: 'Azure',
  14: 'Anthropic',
  24: 'Google Gemini',
  33: 'AWS Bedrock',
  15: 'Google AI Studio',
  8: 'Custom',
  11: 'PaLM (Legacy)',
}

const STATUS_LABELS: Record<number, string> = {
  1: 'Enabled',
  2: 'Disabled',
  3: 'Auto-Banned',
}

/* ---- form state ---- */
interface ChannelForm {
  name: string
  type: number
  base_url: string
  key: string
  models: string
  group: string
  weight: number
  priority: number
}

const EMPTY_FORM: ChannelForm = {
  name: '', type: 1, base_url: '', key: '', models: '', group: 'default', weight: 1, priority: 0,
}

export function Channels() {
  const { t } = useI18n()

  const [channels, setChannels] = useState<Channel[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<number | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  /* modal */
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<ChannelForm>({ ...EMPTY_FORM })
  const [submitting, setSubmitting] = useState(false)

  /* ---- fetch ---- */
  const fetchChannels = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params: Record<string, string | number | boolean | undefined> = {
        p: page,
        page_size: 20,
      }
      if (statusFilter !== undefined) params.status = statusFilter
      const res = await api.get<PaginatedData<Channel>>('/api/channel/', params)
      setChannels(res.items ?? [])
      setTotal(res.total ?? 0)
    } catch (e: any) {
      setError(e.message || 'Failed to load channels')
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter])

  useEffect(() => { fetchChannels() }, [fetchChannels])

  /* ---- handlers ---- */
  const totalPages = Math.ceil(total / 20)

  const openCreate = () => {
    setEditingId(null)
    setForm({ ...EMPTY_FORM })
    setModalOpen(true)
  }

  const openEdit = (ch: Channel) => {
    setEditingId(ch.id)
    setForm({
      name: ch.name,
      type: ch.type,
      base_url: ch.base_url,
      key: ch.key,
      models: ch.models,
      group: ch.group,
      weight: ch.weight,
      priority: ch.priority,
    })
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      if (editingId) {
        await api.put('/api/channel/', { id: editingId, ...form })
      } else {
        await api.post('/api/channel/', form)
      }
      setModalOpen(false)
      fetchChannels()
    } catch (e: any) {
      alert(e.message || 'Operation failed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this channel?')) return
    try {
      await api.del('/api/channel/' + id)
      fetchChannels()
    } catch (e: any) {
      alert(e.message || 'Delete failed')
    }
  }

  const handleTest = async (id: number) => {
    try {
      const data = await api.get<{ response_time: number }>('/api/channel/test/' + id)
      alert('Response time: ' + (data?.response_time ?? 'N/A') + ' ms')
      fetchChannels()
    } catch (e: any) {
      alert(e.message || 'Test failed')
    }
  }

  const handleUpdateBalance = async (id: number) => {
    try {
      await api.get('/api/channel/update_balance/' + id)
      fetchChannels()
    } catch (e: any) {
      alert(e.message || 'Update balance failed')
    }
  }

  const truncate = (s: string, max = 40) =>
    s && s.length > max ? s.slice(0, max) + '...' : s || '-'

  /* ---- render ---- */
  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">{t('channels.title')}</h1>
        <div className="page-actions">
          <select
            className="form-select"
            value={statusFilter ?? ''}
            onChange={(e) => {
              setStatusFilter(e.target.value ? Number(e.target.value) : undefined)
              setPage(1)
            }}
          >
            <option value="">{t('channels.status')}</option>
            <option value="1">{STATUS_LABELS[1]}</option>
            <option value="2">{STATUS_LABELS[2]}</option>
            <option value="3">{STATUS_LABELS[3]}</option>
          </select>
          <button className="btn-primary" onClick={openCreate}>
            + {t('channels.create')}
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
                <th>{t('channels.name')}</th>
                <th>{t('channels.type')}</th>
                <th>{t('channels.status')}</th>
                <th>Base URL</th>
                <th>{t('channels.models')}</th>
                <th>{t('channels.balance')}</th>
                <th>Response Time</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {channels.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center' }}>No channels found</td></tr>
              ) : channels.map((ch) => (
                <tr key={ch.id}>
                  <td>{ch.id}</td>
                  <td>{ch.name || '-'}</td>
                  <td>{CHANNEL_TYPES[ch.type] || `Type ${ch.type}`}</td>
                  <td>
                    <span className={`status-badge status-${ch.status}`}>
                      {STATUS_LABELS[ch.status] || ch.status}
                    </span>
                  </td>
                  <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ch.base_url || '-'}
                  </td>
                  <td title={ch.models} style={{ maxWidth: 180 }}>{truncate(ch.models)}</td>
                  <td>{ch.balance !== undefined ? ch.balance.toFixed(2) : '-'}</td>
                  <td>{ch.response_time ? `${ch.response_time} ms` : '-'}</td>
                  <td>
                    <div className="action-btns">
                      <button className="btn-ghost-sm" onClick={() => openEdit(ch)}>Edit</button>
                      <button className="btn-ghost-sm" onClick={() => handleTest(ch.id)}>{t('channels.test')}</button>
                      <button className="btn-ghost-sm" onClick={() => handleUpdateBalance(ch.id)}>{t('channels.balance')}</button>
                      <button className="btn-danger btn-ghost-sm" onClick={() => handleDelete(ch.id)}>{t('channels.delete')}</button>
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

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingId ? 'Edit Channel' : t('channels.create')}</h2>
              <button className="btn-ghost-sm" onClick={() => setModalOpen(false)}>X</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">{t('channels.name')}</label>
                <input className="form-input" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('channels.type')}</label>
                <select className="form-select" value={form.type}
                  onChange={(e) => setForm({ ...form, type: Number(e.target.value) })}>
                  {Object.entries(CHANNEL_TYPES).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Base URL</label>
                <input className="form-input" value={form.base_url}
                  onChange={(e) => setForm({ ...form, base_url: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Key</label>
                <input className="form-input" type="password" value={form.key}
                  onChange={(e) => setForm({ ...form, key: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('channels.models')} (comma-separated)</label>
                <input className="form-input" value={form.models}
                  onChange={(e) => setForm({ ...form, models: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Group</label>
                <input className="form-input" value={form.group}
                  onChange={(e) => setForm({ ...form, group: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Weight</label>
                <input className="form-input" type="number" value={form.weight}
                  onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })} />
              </div>
              <div className="form-group">
                <label className="form-label">Priority</label>
                <input className="form-input" type="number" value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost-sm" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn-primary" disabled={submitting} onClick={handleSubmit}>
                {submitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
