import { useState } from 'react'
import { toast } from 'sonner'
import { useCountdown } from '@/hooks/use-countdown'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { sendEmailVerification, bindEmail } from '../../api'

// ============================================================================
// Email Bind Dialog Component
// ============================================================================

interface EmailBindDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentEmail?: string
  onSuccess: () => void
}

export function EmailBindDialog({
  open,
  onOpenChange,
  currentEmail,
  onSuccess,
}: EmailBindDialogProps) {
  const [loading, setLoading] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const {
    secondsLeft,
    isActive,
    start: startCountdown,
    reset: resetCountdown,
  } = useCountdown({
    initialSeconds: 60,
  })

  const handleSendCode = async () => {
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address')
      return
    }

    try {
      setSendingCode(true)
      const response = await sendEmailVerification(email)

      if (response.success) {
        toast.success('Verification code sent! Please check your email.')
        startCountdown()
      } else {
        toast.error(response.message || 'Failed to send verification code')
      }
    } catch (error) {
      toast.error('Failed to send verification code')
    } finally {
      setSendingCode(false)
    }
  }

  const handleBind = async () => {
    if (!email || !code) {
      toast.error('Please enter email and verification code')
      return
    }

    try {
      setLoading(true)
      const response = await bindEmail(email, code)

      if (response.success) {
        toast.success('Email bound successfully!')
        onOpenChange(false)
        onSuccess()
        // Reset form
        setEmail('')
        setCode('')
        resetCountdown()
      } else {
        toast.error(response.message || 'Failed to bind email')
      }
    } catch (error) {
      toast.error('Failed to bind email')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!loading) {
      onOpenChange(open)
      if (!open) {
        // Reset form when closing
        setEmail('')
        setCode('')
        resetCountdown()
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Bind Email</DialogTitle>
          <DialogDescription>
            {currentEmail
              ? `Current email: ${currentEmail}. Enter a new email to change.`
              : 'Bind an email address to your account.'}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-4'>
          <div className='space-y-2'>
            <Label htmlFor='email'>Email Address</Label>
            <Input
              id='email'
              type='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder='Enter your email'
              disabled={loading}
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='code'>Verification Code</Label>
            <div className='flex gap-2'>
              <Input
                id='code'
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder='Enter code'
                disabled={loading}
                maxLength={6}
              />
              <Button
                type='button'
                variant='outline'
                onClick={handleSendCode}
                disabled={sendingCode || isActive || !email}
              >
                {isActive
                  ? `${secondsLeft}s`
                  : sendingCode
                    ? 'Sending...'
                    : 'Send'}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            onClick={() => handleOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type='button'
            onClick={handleBind}
            disabled={loading || !email || !code}
          >
            {loading ? 'Binding...' : 'Bind Email'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
