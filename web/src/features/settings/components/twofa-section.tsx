import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  get2FAStatus,
  setup2FA,
  enable2FA,
  disable2FA,
  regenerate2FABackupCodes,
} from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function TwoFASection() {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<any>(null)
  const [code, setCode] = useState('')
  const [setupInfo, setSetupInfo] = useState<any>(null)
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null)

  async function refresh() {
    try {
      const res = await get2FAStatus()
      if (res?.success) setStatus(res.data)
    } catch {}
  }

  useEffect(() => {
    refresh()
  }, [])

  return (
    <div className='space-y-3'>
      <div className='font-medium'>Two-Factor Authentication (2FA)</div>
      <div className='text-muted-foreground text-sm'>
        Status: {status ? JSON.stringify(status) : 'Loading...'}
      </div>
      <div className='flex gap-2'>
        <Button
          variant='secondary'
          disabled={loading}
          onClick={async () => {
            setLoading(true)
            try {
              const res = await setup2FA()
              if (res?.success) {
                setSetupInfo(res.data)
                toast.success('2FA setup initiated')
              } else {
                toast.error(res?.message || 'Setup failed')
              }
            } catch {
              toast.error('Setup failed')
            } finally {
              setLoading(false)
            }
          }}
        >
          Setup 2FA
        </Button>
        <Input
          placeholder='Enter 2FA code'
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className='max-w-[200px]'
        />
        <Button
          disabled={loading || code.length === 0}
          onClick={async () => {
            setLoading(true)
            try {
              const res = await enable2FA(code)
              if (res?.success) {
                toast.success('2FA enabled')
                setCode('')
                await refresh()
              } else {
                toast.error(res?.message || 'Enable failed')
              }
            } catch {
              toast.error('Enable failed')
            } finally {
              setLoading(false)
            }
          }}
        >
          Enable
        </Button>
        <Button
          variant='destructive'
          disabled={loading || code.length === 0}
          onClick={async () => {
            setLoading(true)
            try {
              const res = await disable2FA(code)
              if (res?.success) {
                toast.success('2FA disabled')
                setCode('')
                await refresh()
              } else {
                toast.error(res?.message || 'Disable failed')
              }
            } catch {
              toast.error('Disable failed')
            } finally {
              setLoading(false)
            }
          }}
        >
          Disable
        </Button>
        <Button
          variant='outline'
          disabled={loading || code.length === 0}
          onClick={async () => {
            setLoading(true)
            try {
              const res = await regenerate2FABackupCodes(code)
              if (res?.success) {
                setBackupCodes(res.data || null)
                toast.success('Backup codes regenerated')
              } else {
                toast.error(res?.message || 'Regenerate failed')
              }
            } catch {
              toast.error('Regenerate failed')
            } finally {
              setLoading(false)
            }
          }}
        >
          Regenerate backup codes
        </Button>
      </div>
      {setupInfo && (
        <div className='text-sm'>
          <div className='font-medium'>Setup info</div>
          <pre className='break-words whitespace-pre-wrap'>
            {JSON.stringify(setupInfo)}
          </pre>
        </div>
      )}
      {backupCodes && (
        <div className='text-sm'>
          <div className='font-medium'>Backup codes</div>
          <pre className='break-words whitespace-pre-wrap'>
            {JSON.stringify(backupCodes)}
          </pre>
        </div>
      )}
    </div>
  )
}
