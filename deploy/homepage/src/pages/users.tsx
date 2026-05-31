import { useState, useEffect, useCallback } from 'react'
import { useI18n } from '../i18n'
import { api, type User, type PaginatedData, ROLE } from '../lib/api'

const ROLE_LABELS: Record<number, string> = {
  [ROLE.USER]: 'User',
  [ROLE.ADMIN]: 'Admin',
  [ROLE.ROOT]: 'Root',
}

const STATUS_LABELS: Record<number, string> = {
  1: 'Active',
  2: 'Disabled',
}

/* form state */
interface UserForm {
  username: string
  password: string
  email: string
  role: number
  quota: number
  group: string
  status: number
}

const EMPTY_FORM: UserForm = {
  username: '', password: '', email: '', role: ROLE.USER, quota: 0, group: 'default', status: 1,
}

function formatQuota(quota: number) {
  return (quota / 500000).toFixed(2)
}

export function Users() {
  const { t } = useI18n()

  const [users, setUsers] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<number | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  /* modal */
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<UserForm>({ ...EMPTY_FORM })
  const [submitting, setSubmitting] = useState(false)

  /* ---- fetch ---- */
  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params: Record<string, string | number | boolean | undefined> = {
        p: page,
        page_size: 20,
      }
      if (search) params.keyword = search
      if (roleFilter !== undefined) params.role = roleFilter
      const res = await api.get<PaginatedData<User>>('/api/user/', params)
      setUsers(res.items ?? [])
      setTotal(res.total ?? 0)
    } catch (e: any) {
      setError(e.message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [page, search, roleFilter])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const totalPages = Math.ceil(total / 20)

  /* ---- handlers ---- */
  const openCreate = () => {
    setEditingId(null)
    setForm({ ...EMPTY_FORM })
    setModalOpen(true)
  }

  const openEdit = (u: User) => {
    setEditingId(u.id)
    setForm({
      username: u.username,
      password: '',
      email: u.email,
      role: u.role,
      quota: u.quota,
      group: u.group,
      status: u.status,
    })
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      if (editingId) {
        const payload: Record<string, unknown> = {
          id: editingId,
          username: form.username,
          email: form.email,
          role: form.role,
          quota: form.quota,
          group: form.group,
          status: form.status,
        }
        if (form.password) payload.password = form.password
        await api.put('/api/user/', payload)
      } else {
        await api.post('/api/user/', form)
      }
      setModalOpen(false)
      fetchUsers()
    } catch (e: any) {
      alert(e.message || 'Operation failed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this user?')) return
    try {
      await api.del('/api/user/' + id)
      fetchUsers()
    } catch (e: any) {
      alert(e.message || 'Delete failed')
    }
  }

  /* ---- render ---- */
  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">{t('users.title')}</h1>
        <div className="page-actions">
          <input
            className="form-input"
            placeholder="Search users..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
          <select
            className="form-select"
            value={roleFilter ?? ''}
            onChange={(e) => {
              setRoleFilter(e.target.value ? Number(e.target.value) : undefined)
              setPage(1)
            }}
          >
            <option value="">{t('users.role')}</option>
            <option value={ROLE.USER}>{ROLE_LABELS[ROLE.USER]}</option>
            <option value={ROLE.ADMIN}>{ROLE_LABELS[ROLE.ADMIN]}</option>
            <option value={ROLE.ROOT}>{ROLE_LABELS[ROLE.ROOT]}</option>
          </select>
          <button className="btn-primary" onClick={openCreate}>
            + {t('users.create')}
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
                <th>Username</th>
                <th>Email</th>
                <th>{t('users.role')}</th>
                <th>{t('users.status')}</th>
                <th>{t('users.quota')}</th>
                <th>Used</th>
                <th>Group</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center' }}>No users found</td></tr>
              ) : users.map((u) => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>{u.username}</td>
                  <td>{u.email || '-'}</td>
                  <td>
                    <span className={`role-badge role-${u.role}`}>
                      {ROLE_LABELS[u.role] || `Role ${u.role}`}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge status-${u.status}`}>
                      {STATUS_LABELS[u.status] || u.status}
                    </span>
                  </td>
                  <td>{formatQuota(u.quota)}</td>
                  <td>{formatQuota(u.used_quota)}</td>
                  <td>{u.group || '-'}</td>
                  <td>
                    <div className="action-btns">
                      <button className="btn-ghost-sm" onClick={() => openEdit(u)}>Edit</button>
                      <button className="btn-danger btn-ghost-sm" onClick={() => handleDelete(u.id)}>
                        {t('users.delete')}
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
              <h2>{editingId ? 'Edit User' : t('users.create')}</h2>
              <button className="btn-ghost-sm" onClick={() => setModalOpen(false)}>X</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Username</label>
                <input className="form-input" value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  disabled={!!editingId} />
              </div>
              <div className="form-group">
                <label className="form-label">Password{editingId ? ' (leave blank to keep)' : ''}</label>
                <input className="form-input" type="password" value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('users.role')}</label>
                <select className="form-select" value={form.role}
                  onChange={(e) => setForm({ ...form, role: Number(e.target.value) })}>
                  <option value={ROLE.USER}>{ROLE_LABELS[ROLE.USER]}</option>
                  <option value={ROLE.ADMIN}>{ROLE_LABELS[ROLE.ADMIN]}</option>
                  <option value={ROLE.ROOT}>{ROLE_LABELS[ROLE.ROOT]}</option>
                </select>
              </div>
              {editingId && (
                <div className="form-group">
                  <label className="form-label">{t('users.status')}</label>
                  <select className="form-select" value={form.status}
                    onChange={(e) => setForm({ ...form, status: Number(e.target.value) })}>
                    <option value={1}>{STATUS_LABELS[1]}</option>
                    <option value={2}>{STATUS_LABELS[2]}</option>
                  </select>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">{t('users.quota')}</label>
                <input className="form-input" type="number" value={form.quota}
                  onChange={(e) => setForm({ ...form, quota: Number(e.target.value) })} />
              </div>
              <div className="form-group">
                <label className="form-label">Group</label>
                <input className="form-input" value={form.group}
                  onChange={(e) => setForm({ ...form, group: e.target.value })} />
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
