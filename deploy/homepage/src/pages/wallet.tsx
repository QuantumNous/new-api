import { useState, useEffect } from 'react'
import { Wallet as WalletIcon, ArrowUpRight, Link2, Copy, CheckCircle } from 'lucide-react'
import { useI18n } from '../i18n'
import { useAuth } from '../lib/auth'
import { api, type PaginatedData } from '../lib/api'

interface TopUpRecord {
  id: number
  user_id: number
  amount: number
  trade_no: string
  created_at: number
  status: string
}

function formatQuota(value: number): string {
  return '$' + (value / 500000).toFixed(2)
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString()
}

export function Wallet() {
  const { t } = useI18n()
  const { user } = useAuth()
  const [amount, setAmount] = useState('')
  const [paying, setPaying] = useState(false)
  const [history, setHistory] = useState<TopUpRecord[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    api.get<PaginatedData<TopUpRecord>>('/api/user/topup/self', { p: 0, page_size: 20 })
      .then((res) => setHistory(res.items || []))
      .catch(() => {})
      .finally(() => setLoadingHistory(false))
  }, [])

  const handlePay = async () => {
    const val = Number(amount)
    if (!val || val <= 0) return
    setPaying(true)
    try {
      await api.post('/api/user/self/pay', { amount: val })
      setAmount('')
      // Refresh user data
      window.location.reload()
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setPaying(false)
    }
  }

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard not available */ }
  }

  const affLink = user?.invite_url || (user?.aff_code ? `${window.location.origin}/register?aff=${user.aff_code}` : '')

  return (
    <div className="wallet-page">
      <div className="page-header">
        <h1 className="page-title">{t('wallet.title')}</h1>
      </div>

      <div className="balance-card">
        <div className="balance-icon">
          <WalletIcon size={24} />
        </div>
        <div className="balance-label">{t('wallet.balance')}</div>
        <div className="balance-value">{formatQuota(user?.quota ?? 0)}</div>
        <div className="balance-sub">
          Used: {formatQuota(user?.used_quota ?? 0)}
        </div>
      </div>

      <div className="page-section">
        <h2 className="section-subtitle">{t('wallet.topUp')}</h2>
        <div className="topup-form">
          <div className="input-row">
            <span className="input-prefix">$</span>
            <input
              className="form-input has-prefix"
              type="number"
              min="1"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
            />
            <button
              className="btn-primary"
              onClick={handlePay}
              disabled={paying || !amount || Number(amount) <= 0}
            >
              {paying ? 'Processing...' : <><ArrowUpRight size={14} /> Pay</>}
            </button>
          </div>
          <div className="quick-amounts">
            {[5, 10, 25, 50, 100].map((v) => (
              <button key={v} className="quick-btn" onClick={() => setAmount(String(v))}>
                ${v}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="page-section">
        <h2 className="section-subtitle">{t('wallet.affCode')}</h2>
        <div className="aff-info">
          <div className="aff-row">
            <span className="aff-label">{t('common.affiliateCode')}</span>
            <div className="aff-value-group">
              <code className="aff-code">{user?.aff_code || '-'}</code>
              <button className="btn-icon" onClick={() => handleCopy(user?.aff_code || '')}>
                {copied ? <CheckCircle size={14} style={{ color: 'var(--accent)' }} /> : <Copy size={14} />}
              </button>
            </div>
          </div>
          {affLink && (
            <div className="aff-row">
              <span className="aff-label"><Link2 size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />{t('common.inviteLink')}</span>
              <code className="aff-link">{affLink}</code>
            </div>
          )}
        </div>
      </div>

      <div className="page-section">
        <h2 className="section-subtitle">{t('wallet.history')}</h2>
        {loadingHistory ? (
          <div className="loading-state">Loading history...</div>
        ) : history.length === 0 ? (
          <div className="empty-state">No top-up records found.</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Amount</th>
                  <th>Trade No</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((record) => (
                  <tr key={record.id}>
                    <td className="mono-sm">{formatDate(record.created_at)}</td>
                    <td className="mono-sm">${record.amount}</td>
                    <td className="mono-sm">{record.trade_no || '-'}</td>
                    <td>
                      <span className={`status-badge ${record.status === 'success' ? 'success' : ''}`}>
                        {record.status || 'pending'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        .wallet-page { display: flex; flex-direction: column; gap: 20px; }

        .page-header {
          display: flex; align-items: center; justify-content: space-between;
          padding-bottom: 20px; border-bottom: 1px solid var(--line);
        }
        .page-title {
          font-family: var(--sans); font-size: 22px; font-weight: 700;
          letter-spacing: -0.02em;
        }

        .balance-card {
          background: var(--surface); border: 1px solid var(--line);
          border-radius: 8px; padding: 32px;
          text-align: center;
          position: relative; overflow: hidden;
        }
        .balance-card::before {
          content: ''; position: absolute; top: -50%; left: -20%; width: 200px; height: 200px;
          border-radius: 50%; pointer-events: none;
          background: radial-gradient(circle, color-mix(in srgb, var(--accent) 10%, transparent), transparent 70%);
        }
        .balance-icon {
          width: 48px; height: 48px; display: flex; align-items: center; justify-content: center;
          border-radius: 8px; margin: 0 auto 16px;
          background: color-mix(in srgb, var(--accent) 12%, transparent);
          color: var(--accent);
        }
        .balance-label {
          font-family: var(--mono); font-size: 11px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted);
          margin-bottom: 8px;
        }
        .balance-value {
          font-family: var(--mono); font-size: 42px; font-weight: 700;
          color: var(--accent);
          text-shadow: 0 0 30px color-mix(in srgb, var(--accent) 25%, transparent);
          position: relative;
        }
        .balance-sub {
          font-family: var(--mono); font-size: 12px; color: var(--muted);
          margin-top: 8px; position: relative;
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

        .topup-form {}
        .input-row {
          display: flex; align-items: center; gap: 10px;
        }
        .input-prefix {
          font-family: var(--mono); font-size: 16px; font-weight: 700;
          color: var(--muted); flex-shrink: 0;
        }
        .form-input {
          flex: 1; padding: 10px 12px;
          font-family: var(--mono); font-size: 14px;
          background: var(--bg); border: 1px solid var(--line);
          border-radius: 4px; color: var(--text);
          transition: border-color 0.2s;
        }
        .form-input:focus { outline: none; border-color: var(--accent); }
        .quick-amounts {
          display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px;
        }
        .quick-btn {
          font-family: var(--mono); font-size: 12px; font-weight: 600;
          padding: 6px 14px; border-radius: 4px;
          border: 1px solid var(--line); color: var(--muted);
          transition: all 0.15s;
        }
        .quick-btn:hover {
          border-color: var(--accent); color: var(--accent);
          background: color-mix(in srgb, var(--accent) 8%, transparent);
        }

        .btn-primary {
          display: inline-flex; align-items: center; gap: 6px;
          font-family: var(--mono); font-size: 11px; font-weight: 700;
          letter-spacing: 0.04em; text-transform: uppercase;
          border-radius: 4px; padding: 10px 18px;
          background: var(--accent); color: var(--bg);
          transition: all 0.2s; white-space: nowrap;
        }
        .btn-primary:hover { box-shadow: 0 0 20px color-mix(in srgb, var(--accent) 30%, transparent); }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

        .aff-info { display: flex; flex-direction: column; gap: 12px; }
        .aff-row {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          padding: 10px 14px; background: var(--bg); border: 1px solid var(--line);
          border-radius: 4px;
        }
        .aff-label {
          font-family: var(--mono); font-size: 11px; font-weight: 600;
          color: var(--muted); white-space: nowrap;
        }
        .aff-value-group { display: flex; align-items: center; gap: 8px; }
        .aff-code {
          font-family: var(--mono); font-size: 13px; color: var(--accent);
          letter-spacing: 0.02em;
        }
        .aff-link {
          font-family: var(--mono); font-size: 11px; color: var(--text);
          word-break: break-all; text-align: right;
        }
        .btn-icon {
          display: inline-flex; align-items: center; gap: 4px;
          background: none; border: none; color: var(--muted);
          padding: 4px; border-radius: 3px; cursor: pointer;
          transition: color 0.15s;
        }
        .btn-icon:hover { color: var(--text); }

        .table-wrap { overflow-x: auto; }
        .data-table { width: 100%; border-collapse: collapse; }
        .data-table th {
          font-family: var(--mono); font-size: 10px; font-weight: 700;
          letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted);
          text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--line);
        }
        .data-table td {
          font-size: 13px; padding: 10px 12px; border-bottom: 1px solid var(--line);
        }
        .data-table tr:last-child td { border-bottom: none; }
        .data-table tr:hover td { background: var(--surface2); }
        .mono-sm { font-family: var(--mono); font-size: 12px; }

        .status-badge {
          font-family: var(--mono); font-size: 10px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.06em;
          padding: 3px 8px; border-radius: 3px;
          background: var(--surface2); color: var(--muted);
        }
        .status-badge.success { color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, transparent); }

        .loading-state, .empty-state {
          padding: 32px; text-align: center; color: var(--muted);
          font-family: var(--mono); font-size: 13px;
        }
      `}</style>
    </div>
  )
}
