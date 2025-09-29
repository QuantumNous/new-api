import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { CopyIcon, CheckIcon } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export const Route = createFileRoute('/(auth)/reset')({
  component: ResetPasswordConfirm,
})

function ResetPasswordConfirm() {
  const navigate = useNavigate()
  const search = useSearch({ from: '/(auth)/reset' }) as {
    email?: string
    token?: string
  }
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const isValidResetLink = search?.email && search?.token

  async function handleSubmit() {
    if (!search?.email || !search?.token) {
      toast.error('Invalid reset link, please request a new password reset')
      return
    }
    setLoading(true)
    try {
      const res = await api.post('/api/user/reset', {
        email: search.email,
        token: search.token,
      })
      if (res?.data?.success) {
        const password = res.data.data
        setNewPassword(password)
        await navigator.clipboard.writeText(password)
        toast.success(`Password reset and copied to clipboard: ${password}`)
      } else {
        toast.error(res?.data?.message || 'Reset failed')
      }
    } catch {
      toast.error('Reset failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (newPassword) {
      await navigator.clipboard.writeText(newPassword)
      setCopied(true)
      toast.success(`Password copied to clipboard: ${newPassword}`)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  useEffect(() => {
    if (!isValidResetLink) {
      toast.error('Invalid reset link')
      setTimeout(() => navigate({ to: '/sign-in', replace: true }), 2000)
    }
  }, [isValidResetLink, navigate])

  return (
    <div className='flex min-h-[calc(100vh-4rem)] items-center justify-center'>
      <Card className='w-full max-w-md'>
        <CardHeader>
          <CardTitle>Password Reset Confirmation</CardTitle>
          <CardDescription>
            {newPassword
              ? 'Your password has been reset successfully'
              : 'Confirm to reset your password'}
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          {!isValidResetLink && (
            <div className='bg-destructive/10 text-destructive rounded-lg p-3 text-sm'>
              Invalid reset link, please request a new password reset
            </div>
          )}
          <div className='space-y-2'>
            <Label htmlFor='email'>Email</Label>
            <Input
              id='email'
              type='email'
              value={search?.email || ''}
              disabled
              placeholder='Waiting for email...'
            />
          </div>
          {newPassword && (
            <div className='space-y-2'>
              <Label htmlFor='password'>New Password</Label>
              <div className='flex gap-2'>
                <Input
                  id='password'
                  value={newPassword}
                  disabled
                  className='font-mono'
                />
                <Button
                  type='button'
                  size='icon'
                  variant='outline'
                  onClick={handleCopy}
                >
                  {copied ? (
                    <CheckIcon className='h-4 w-4' />
                  ) : (
                    <CopyIcon className='h-4 w-4' />
                  )}
                </Button>
              </div>
              <p className='text-muted-foreground text-xs'>
                Password has been copied to clipboard
              </p>
            </div>
          )}
          <Button
            className='w-full'
            onClick={
              newPassword
                ? () => navigate({ to: '/sign-in', replace: true })
                : handleSubmit
            }
            disabled={loading || !!newPassword || !isValidResetLink}
          >
            {newPassword ? 'Return to Login' : 'Confirm Reset Password'}
          </Button>
          {!newPassword && (
            <Button
              variant='link'
              className='w-full'
              onClick={() => navigate({ to: '/sign-in', replace: true })}
            >
              Back to Login
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
