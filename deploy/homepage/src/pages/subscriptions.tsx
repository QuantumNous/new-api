import { useState, useEffect } from 'react'
import { CreditCard, CheckCircle, XCircle, Zap } from 'lucide-react'
import { useI18n } from '../i18n'
import { api } from '../lib/api'

interface SubscriptionPlan {
  id: number
  name: string
  description: string
  price: number
  duration_days: number
  models: string
  quota: number
  group: string
  status: number
}

interface ActiveSubscription {
  id: number
  plan_id: number
  plan_name: string
  status: number
  start_time: number
  end_time: number
  quota: number
  used_quota: number
}

function formatQuota(value: number): string {
  return '$' + (value / 500000).toFixed(2)
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString()
}

export function Subscriptions() {
  const { t } = useI18n()
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [subscriptions, setSubscriptions] = useState<ActiveSubscription[]>([])
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState<number | null>(null)

  useEffect(() => {
    Promise.all([
      api.get<SubscriptionPlan[]>('/api/subscription/plans').catch(() => []),
      api.get<ActiveSubscription[]>('/api/subscription/self').catch(() => []),
    ]).then(([plansData, subsData]) => {
      setPlans(Array.isArray(plansData) ? plansData : [])
      setSubscriptions(Array.isArray(subsData) ? subsData : [])
      setLoading(false)
    })
  }, [])

  const handlePurchase = async (planId: number) => {
    setPurchasing(planId)
    try {
      await api.post('/api/subscription/balance/pay', { plan_id: planId })
      // Refresh subscriptions
      const subsData = await api.get<ActiveSubscription[]>('/api/subscription/self').catch(() => [])
      setSubscriptions(Array.isArray(subsData) ? subsData : [])
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setPurchasing(null)
    }
  }

  return (
    <div className="subscriptions-page">
      <div className="page-header">
        <h1 className="page-title">{t('subs.title')}</h1>
      </div>

      {subscriptions.length > 0 && (
        <div className="page-section">
          <h2 className="section-subtitle">{t('subs.active')}</h2>
          <div className="subs-grid">
            {subscriptions.map((sub) => {
              const isActive = sub.status === 1 && sub.end_time > Date.now() / 1000
              const progressPct = sub.quota > 0 ? Math.min((sub.used_quota / sub.quota) * 100, 100) : 0

              return (
                <div key={sub.id} className="sub-card active">
                  <div className="sub-card-header">
                    <div className="sub-card-name">{sub.plan_name}</div>
                    <span className={`sub-status ${isActive ? 'active' : 'expired'}`}>
                      {isActive ? <CheckCircle size={12} /> : <XCircle size={12} />}
                      {isActive ? 'Active' : 'Expired'}
                    </span>
                  </div>
                  <div className="sub-card-body">
                    <div className="sub-detail">
                      <span className="sub-detail-label">Period</span>
                      <span className="mono-sm">{formatDate(sub.start_time)} - {formatDate(sub.end_time)}</span>
                    </div>
                    <div className="sub-detail">
                      <span className="sub-detail-label">Quota</span>
                      <span className="mono-sm">{formatQuota(sub.used_quota)} / {formatQuota(sub.quota)}</span>
                    </div>
                    <div className="sub-progress-track">
                      <div className="sub-progress-fill" style={{ width: `${progressPct}%` }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="page-section">
        <h2 className="section-subtitle">{t('subs.plans')}</h2>
        {loading ? (
          <div className="loading-state">Loading plans...</div>
        ) : plans.length === 0 ? (
          <div className="empty-state">No subscription plans available.</div>
        ) : (
          <div className="plans-grid">
            {plans.map((plan) => (
              <div key={plan.id} className="plan-card">
                <div className="plan-card-header">
                  <CreditCard size={18} style={{ color: 'var(--accent2)' }} />
                  <h3 className="plan-name">{plan.name}</h3>
                </div>
                <p className="plan-desc">{plan.description}</p>
                <div className="plan-price">
                  <span className="plan-price-value">{formatQuota(plan.price)}</span>
                  <span className="plan-price-period">/ {plan.duration_days} days</span>
                </div>
                <div className="plan-features">
                  {plan.models && (
                    <div className="plan-feature">
                      <Zap size={12} />
                      <span>Models: {plan.models || 'All'}</span>
                    </div>
                  )}
                  <div className="plan-feature">
                    <Zap size={12} />
                    <span>Quota: {formatQuota(plan.quota)}</span>
                  </div>
                  {plan.group && (
                    <div className="plan-feature">
                      <Zap size={12} />
                      <span>Group: {plan.group}</span>
                    </div>
                  )}
                </div>
                <button
                  className="btn-primary plan-btn"
                  onClick={() => handlePurchase(plan.id)}
                  disabled={purchasing === plan.id}
                >
                  {purchasing === plan.id ? 'Processing...' : t('subs.purchase')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .subscriptions-page { display: flex; flex-direction: column; gap: 24px; }

        .page-header {
          display: flex; align-items: center; justify-content: space-between;
          padding-bottom: 20px; border-bottom: 1px solid var(--line);
        }
        .page-title {
          font-family: var(--sans); font-size: 22px; font-weight: 700;
          letter-spacing: -0.02em;
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

        .subs-grid { display: grid; gap: 12px; }
        @media (min-width: 768px) { .subs-grid { grid-template-columns: repeat(2, 1fr); } }

        .sub-card {
          background: var(--bg); border: 1px solid var(--line);
          border-radius: 6px; padding: 16px;
        }
        .sub-card-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 12px;
        }
        .sub-card-name {
          font-family: var(--mono); font-size: 14px; font-weight: 700;
        }
        .sub-status {
          display: inline-flex; align-items: center; gap: 4px;
          font-family: var(--mono); font-size: 10px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.06em;
          padding: 3px 8px; border-radius: 3px;
        }
        .sub-status.active {
          color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, transparent);
        }
        .sub-status.expired {
          color: var(--danger); background: color-mix(in srgb, var(--danger) 10%, transparent);
        }

        .sub-card-body { display: flex; flex-direction: column; gap: 8px; }
        .sub-detail {
          display: flex; align-items: center; justify-content: space-between;
        }
        .sub-detail-label {
          font-family: var(--mono); font-size: 11px; color: var(--muted);
          text-transform: uppercase; letter-spacing: 0.04em;
        }
        .mono-sm { font-family: var(--mono); font-size: 12px; }

        .sub-progress-track {
          height: 4px; border-radius: 2px; background: var(--surface2);
          overflow: hidden; margin-top: 4px;
        }
        .sub-progress-fill {
          height: 100%; border-radius: 2px;
          background: var(--accent);
          transition: width 0.4s;
        }

        .plans-grid { display: grid; gap: 16px; }
        @media (min-width: 768px) { .plans-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (min-width: 1024px) { .plans-grid { grid-template-columns: repeat(3, 1fr); } }

        .plan-card {
          background: var(--bg); border: 1px solid var(--line);
          border-radius: 6px; padding: 20px;
          display: flex; flex-direction: column;
          transition: border-color 0.2s;
        }
        .plan-card:hover { border-color: var(--accent2); }

        .plan-card-header {
          display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
        }
        .plan-name {
          font-family: var(--mono); font-size: 14px; font-weight: 700;
          letter-spacing: 0.02em; text-transform: uppercase;
        }
        .plan-desc {
          color: var(--muted); font-size: 12px; line-height: 1.5;
          margin-bottom: 16px;
        }
        .plan-price {
          display: flex; align-items: baseline; gap: 4px; margin-bottom: 16px;
        }
        .plan-price-value {
          font-family: var(--mono); font-size: 28px; font-weight: 700;
          color: var(--accent2);
        }
        .plan-price-period {
          font-family: var(--mono); font-size: 12px; color: var(--muted);
        }

        .plan-features { display: flex; flex-direction: column; gap: 6px; margin-bottom: 20px; flex: 1; }
        .plan-feature {
          display: flex; align-items: center; gap: 6px;
          font-family: var(--mono); font-size: 11px; color: var(--muted);
        }
        .plan-feature svg { color: var(--accent); flex-shrink: 0; }

        .btn-primary {
          display: inline-flex; align-items: center; justify-content: center; gap: 6px;
          font-family: var(--mono); font-size: 11px; font-weight: 700;
          letter-spacing: 0.04em; text-transform: uppercase;
          border-radius: 4px; padding: 10px 16px;
          background: var(--accent); color: var(--bg);
          transition: all 0.2s;
        }
        .btn-primary:hover { box-shadow: 0 0 20px color-mix(in srgb, var(--accent) 30%, transparent); }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .plan-btn { margin-top: auto; }

        .loading-state, .empty-state {
          padding: 48px 24px; text-align: center; color: var(--muted);
          font-family: var(--mono); font-size: 13px;
        }
      `}</style>
    </div>
  )
}
