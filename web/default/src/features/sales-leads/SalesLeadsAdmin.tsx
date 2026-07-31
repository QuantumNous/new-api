import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'

interface SalesLead {
  id: number
  name: string
  email: string
  company: string
  region: string
  use_case: string
  monthly_volume: string
  required_models: string
  message: string
  status: string
  source: string
  created_at: number
  updated_at: number
}

const STATUSES = ['new', 'contacted', 'qualified', 'won', 'lost']
const STATUS_LABEL: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  won: 'Won',
  lost: 'Lost',
}

function fmtTime(ts: number) {
  if (!ts) return '-'
  return new Date(ts * 1000).toLocaleString()
}

export function SalesLeadsAdmin() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-sales-leads', statusFilter],
    queryFn: () =>
      api
        .get('/api/admin/sales-leads', {
          params: statusFilter ? { status: statusFilter } : {},
        })
        .then((r) => (r.data?.data?.items ?? []) as SalesLead[])
        .catch(() => [] as SalesLead[]),
  })

  const update = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.put(`/api/admin/sales-leads/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-sales-leads'] }),
  })

  return (
    <div className='p-6'>
      <div className='mb-4 flex items-center justify-between'>
        <h1 className='text-xl font-semibold text-foreground'>Sales Leads</h1>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className='rounded-md border border-white/10 bg-[#111827] px-3 py-2 text-sm text-foreground'
        >
          <option value=''>All</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <p className='text-sm text-[#94A3B8]'>Loading…</p>
      ) : (
        <div className='overflow-x-auto rounded-xl border border-white/10'>
          <table className='w-full text-left text-sm'>
            <thead className='bg-[#0b1120] text-[#94A3B8]'>
              <tr>
                <th className='p-3'>Name</th>
                <th className='p-3'>Email</th>
                <th className='p-3'>Company</th>
                <th className='p-3'>Region</th>
                <th className='p-3'>Use case</th>
                <th className='p-3'>Status</th>
                <th className='p-3'>Created</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((lead) => (
                <tr key={lead.id} className='border-t border-white/10'>
                  <td className='p-3 text-foreground'>{lead.name}</td>
                  <td className='p-3 text-foreground'>{lead.email}</td>
                  <td className='p-3 text-foreground'>{lead.company}</td>
                  <td className='p-3 text-foreground'>{lead.region}</td>
                  <td className='p-3 max-w-xs truncate text-[#94A3B8]' title={lead.use_case}>
                    {lead.use_case}
                  </td>
                  <td className='p-3'>
                    <select
                      value={lead.status}
                      onChange={(e) => update.mutate({ id: lead.id, status: e.target.value })}
                      className='rounded-md border border-white/10 bg-[#111827] px-2 py-1 text-xs text-foreground'
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className='p-3 text-[#94A3B8]'>{fmtTime(lead.created_at)}</td>
                </tr>
              ))}
              {data?.length === 0 && (
                <tr>
                  <td colSpan={7} className='p-6 text-center text-[#94A3B8]'>
                    No leads yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
