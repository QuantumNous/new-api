import { useState, useEffect, useCallback } from 'react'
import { useI18n } from '../i18n'
import { api, type PaginatedData } from '../lib/api'

/* ---- model type ---- */
interface Model {
  id: number
  model_id: string
  vendor: string
  enabled: boolean
  input_price: number
  output_price: number
  description: string
}

/* ---- form state ---- */
interface ModelForm {
  model_id: string
  vendor: string
  enabled: boolean
  input_price: number
  output_price: number
  description: string
}

const EMPTY_FORM: ModelForm = {
  model_id: '', vendor: '', enabled: true, input_price: 0, output_price: 0, description: '',
}

export function Models() {
  const { t } = useI18n()

  const [models, setModels] = useState<Model[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  /* modal */
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<ModelForm>({ ...EMPTY_FORM })
  const [submitting, setSubmitting] = useState(false)

  /* ---- fetch ---- */
  const fetchModels = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get<PaginatedData<Model>>('/api/models/', {
        p: page,
        page_size: 20,
      })
      setModels(res.items ?? [])
      setTotal(res.total ?? 0)
    } catch (e: any) {
      setError(e.message || 'Failed to load models')
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { fetchModels() }, [fetchModels])

  const totalPages = Math.ceil(total / 20)

  /* ---- handlers ---- */
  const openCreate = () => {
    setEditingId(null)
    setForm({ ...EMPTY_FORM })
    setModalOpen(true)
  }

  const openEdit = (m: Model) => {
    setEditingId(m.id)
    setForm({
      model_id: m.model_id,
      vendor: m.vendor,
      enabled: m.enabled,
      input_price: m.input_price,
      output_price: m.output_price,
      description: m.description,
    })
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      if (editingId) {
        await api.put('/api/models/', { id: editingId, ...form })
      } else {
        await api.post('/api/models/', form)
      }
      setModalOpen(false)
      fetchModels()
    } catch (e: any) {
      alert(e.message || 'Operation failed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this model?')) return
    try {
      await api.del('/api/models/' + id)
      fetchModels()
    } catch (e: any) {
      alert(e.message || 'Delete failed')
    }
  }

  const formatPrice = (price: number) => {
    if (price === 0) return '-'
    return `$${price.toFixed(4)}`
  }

  /* ---- render ---- */
  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">{t('models.title')}</h1>
        <div className="page-actions">
          <button className="btn-primary" onClick={openCreate}>
            + {t('models.create')}
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
                <th>{t('models.modelId')}</th>
                <th>{t('models.vendor')}</th>
                <th>{t('models.enabled')}</th>
                <th>{t('models.inputPrice')}</th>
                <th>{t('models.outputPrice')}</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {models.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center' }}>No models found</td></tr>
              ) : models.map((m) => (
                <tr key={m.id}>
                  <td>{m.id}</td>
                  <td style={{ fontFamily: 'var(--mono)' }}>{m.model_id}</td>
                  <td>{m.vendor || '-'}</td>
                  <td>
                    <span className={`status-badge ${m.enabled ? 'status-1' : 'status-2'}`}>
                      {m.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td>{formatPrice(m.input_price)}</td>
                  <td>{formatPrice(m.output_price)}</td>
                  <td>
                    <div className="action-btns">
                      <button className="btn-ghost-sm" onClick={() => openEdit(m)}>Edit</button>
                      <button className="btn-danger btn-ghost-sm" onClick={() => handleDelete(m.id)}>
                        Delete
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

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingId ? t('models.edit') : t('models.create')}</h2>
              <button className="btn-ghost-sm" onClick={() => setModalOpen(false)}>X</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">{t('models.modelId')}</label>
                <input className="form-input" value={form.model_id}
                  onChange={(e) => setForm({ ...form, model_id: e.target.value })}
                  disabled={!!editingId} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('models.vendor')}</label>
                <input className="form-input" value={form.vendor}
                  onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('models.enabled')}</label>
                <select className="form-select" value={form.enabled ? 'true' : 'false'}
                  onChange={(e) => setForm({ ...form, enabled: e.target.value === 'true' })}>
                  <option value="true">{t('common.enabled')}</option>
                  <option value="false">{t('common.disabled')}</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{t('models.inputPrice')}</label>
                <input className="form-input" type="number" step="0.0001" value={form.input_price}
                  onChange={(e) => setForm({ ...form, input_price: Number(e.target.value) })} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('models.outputPrice')}</label>
                <input className="form-input" type="number" step="0.0001" value={form.output_price}
                  onChange={(e) => setForm({ ...form, output_price: Number(e.target.value) })} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('common.description')}</label>
                <input className="form-input" value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost-sm" onClick={() => setModalOpen(false)}>{t('common.cancel')}</button>
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
