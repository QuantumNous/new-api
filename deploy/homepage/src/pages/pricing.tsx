import { useState, useEffect, useMemo } from 'react'
import { useI18n } from '../i18n'
import { api } from '../lib/api'

interface PricingModel {
  model_name: string
  model_owner?: string
  input_price?: number
  output_price?: number
  group_ratio?: number
  [key: string]: unknown
}

interface PricingGroup {
  vendor: string
  models: PricingModel[]
}

export function Pricing() {
  const { t } = useI18n()
  const [groups, setGroups] = useState<PricingGroup[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<PricingModel[]>('/api/pricing')
      .then((data) => {
        const list = Array.isArray(data) ? data : []
        const vendorMap = new Map<string, PricingModel[]>()
        for (const m of list) {
          const vendor = m.model_owner || m.model_name.split('/')[0] || 'Other'
          if (!vendorMap.has(vendor)) vendorMap.set(vendor, [])
          vendorMap.get(vendor)!.push(m)
        }
        const result: PricingGroup[] = []
        for (const [vendor, models] of vendorMap) {
          result.push({ vendor, models })
        }
        setGroups(result)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return groups
    const q = search.toLowerCase()
    return groups
      .map((g) => ({
        ...g,
        models: g.models.filter((m) => m.model_name.toLowerCase().includes(q)),
      }))
      .filter((g) => g.models.length > 0)
  }, [groups, search])

  return (
    <div className="page-container">
      <h1 className="page-title">{t('pricing.title')}</h1>

      <div className="pricing-controls">
        <input
          type="text"
          className="pricing-search"
          placeholder={t('pricing.model') + '...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="page-loading"><div className="spinner" /></div>
      ) : (
        <div className="pricing-groups">
          {filtered.map((group) => (
            <div key={group.vendor} className="pricing-group">
              <h2 className="pricing-vendor">{group.vendor}</h2>
              <div className="pricing-table-wrap">
                <table className="pricing-table">
                  <thead>
                    <tr>
                      <th>{t('pricing.model')}</th>
                      <th>{t('pricing.input')}</th>
                      <th>{t('pricing.output')}</th>
                      <th>{t('pricing.group')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.models.map((m) => (
                      <tr key={m.model_name}>
                        <td className="pricing-model-name">{m.model_name}</td>
                        <td>{m.input_price != null ? `$${m.input_price}` : '-'}</td>
                        <td>{m.output_price != null ? `$${m.output_price}` : '-'}</td>
                        <td>{m.group_ratio != null ? m.group_ratio : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {filtered.length === 0 && !loading && (
            <div className="pricing-empty">No models found.</div>
          )}
        </div>
      )}
    </div>
  )
}
