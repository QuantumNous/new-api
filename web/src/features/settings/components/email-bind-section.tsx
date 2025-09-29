import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Turnstile } from '@/components/turnstile'
import {
  bindEmail,
  sendEmailVerification,
  getStatus,
} from '@/features/auth/api'

export function EmailBindSection() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<any>(null)
  const [turnstileToken, setTurnstileToken] = useState('')

  if (!status) {
    getStatus()
      .then((s) => setStatus(s))
      .catch(() => {})
  }

  return (
    <div className='space-y-3'>
      <div className='font-medium'>Email Binding</div>
      <div className='flex items-center gap-2'>
        <Input
          placeholder='Email address'
          type='email'
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className='max-w-[260px]'
        />
        <Button
          variant='secondary'
          disabled={loading || !email}
          onClick={async () => {
            setLoading(true)
            try {
              const res = await sendEmailVerification(email, turnstileToken)
              if (res?.success) toast.success('Verification sent')
              else toast.error(res?.message || 'Failed')
            } catch {
              toast.error('Failed')
            } finally {
              setLoading(false)
            }
          }}
        >
          Send Code
        </Button>
      </div>
      {status?.turnstile_check && status?.turnstile_site_key && (
        <div className='mt-2'>
          <Turnstile
            siteKey={status.turnstile_site_key}
            onVerify={(t) => setTurnstileToken(t)}
          />
        </div>
      )}
      <div className='flex items-center gap-2'>
        <Input
          placeholder='Verification code'
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className='max-w-[200px]'
        />
        <Button
          disabled={loading || !email || !code}
          onClick={async () => {
            setLoading(true)
            try {
              const res = await bindEmail(email, code)
              if (res?.success) toast.success('Email bound')
              else toast.error(res?.message || 'Bind failed')
            } catch {
              toast.error('Bind failed')
            } finally {
              setLoading(false)
            }
          }}
        >
          Bind Email
        </Button>
      </div>
    </div>
  )
}
