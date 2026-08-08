import { useState } from 'react'

import { useSiteContent } from '../hooks/useSiteContent'

const REGIONS = ['中国', '东南亚', '北美', '欧洲', '其他']

export function ContactForm() {
  const c = useSiteContent()
  const [form, setForm] = useState({
    name: '',
    email: '',
    company: '',
    region: '',
    use_case: '',
    monthly_volume: '',
    message: '',
  })
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>(
    'idle',
  )
  const [errorMsg, setErrorMsg] = useState('')

  function update(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('submitting')
    setErrorMsg('')
    try {
      const res = await fetch('/api/public/sales-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, source: window.location.pathname }),
      })
      const json = await res.json()
      if (json?.success) {
        setStatus('success')
      } else {
        setStatus('error')
        setErrorMsg(json?.message || c.contact.error)
      }
    } catch {
      setStatus('error')
      setErrorMsg(c.contact.error)
    }
  }

  if (status === 'success') {
    return (
      <div className='rounded-xl border border-[#10B981]/30 bg-[#111827]/70 p-8 text-center'>
        <div className='text-lg font-medium text-[#10B981]'>
          {c.contact.success}
        </div>
      </div>
    )
  }

  return (
    <form
      onSubmit={onSubmit}
      className='mx-auto grid max-w-2xl gap-4 rounded-2xl border border-white/10 bg-[#111827]/70 p-8'
    >
      <div className='grid gap-4 md:grid-cols-2'>
        <Field label={c.contact.name}>
          <input
            required
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            className='input'
          />
        </Field>
        <Field label={c.contact.email}>
          <input
            required
            type='email'
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            className='input'
          />
        </Field>
        <Field label={c.contact.company}>
          <input
            value={form.company}
            onChange={(e) => update('company', e.target.value)}
            className='input'
          />
        </Field>
        <Field label={c.contact.region}>
          <select
            required
            value={form.region}
            onChange={(e) => update('region', e.target.value)}
            className='input'
          >
            <option value=''>{c.contact.region}</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label={c.contact.useCase}>
        <input
          required
          value={form.use_case}
          onChange={(e) => update('use_case', e.target.value)}
          className='input'
        />
      </Field>
      <Field label={c.contact.volume}>
        <input
          value={form.monthly_volume}
          onChange={(e) => update('monthly_volume', e.target.value)}
          className='input'
        />
      </Field>
      <Field label={c.contact.message}>
        <textarea
          rows={4}
          value={form.message}
          onChange={(e) => update('message', e.target.value)}
          className='input'
        />
      </Field>

      {status === 'error' && (
        <p className='text-sm text-red-400'>{errorMsg}</p>
      )}

      <button
        type='submit'
        disabled={status === 'submitting'}
        className='rounded-lg bg-gradient-to-r from-[#4F8CFF] to-[#22D3EE] px-6 py-3 font-medium text-white shadow-lg shadow-[#4F8CFF]/30 transition hover:opacity-90 disabled:opacity-60'
      >
        {status === 'submitting' ? c.contact.submitting : c.contact.submit}
      </button>

      <style>{`
        .input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.04);
          padding: 0.6rem 0.8rem;
          color: #F8FAFC;
          outline: none;
        }
        .input:focus { border-color: #4F8CFF; }
      `}</style>
    </form>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className='block'>
      <span className='mb-1.5 block text-sm text-[#94A3B8]'>{label}</span>
      {children}
    </label>
  )
}
