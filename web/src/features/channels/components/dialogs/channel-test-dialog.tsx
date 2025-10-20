import { useState } from 'react'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
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
import { handleTestChannel } from '../../lib'
import { useChannels } from '../channels-provider'

type ChannelTestDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ChannelTestDialog({
  open,
  onOpenChange,
}: ChannelTestDialogProps) {
  const { currentRow } = useChannels()
  const [testModel, setTestModel] = useState('')
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    responseTime?: number
    error?: string
  } | null>(null)

  if (!currentRow) return null

  const handleTest = async () => {
    setIsTesting(true)
    setTestResult(null)

    handleTestChannel(
      currentRow.id,
      testModel || undefined,
      (success, responseTime, error) => {
        setTestResult({ success, responseTime, error })
        setIsTesting(false)
      }
    )
  }

  const handleClose = () => {
    setTestModel('')
    setTestResult(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Test Channel Connection</DialogTitle>
          <DialogDescription>
            Test connectivity for: <strong>{currentRow.name}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-4'>
          <div className='space-y-2'>
            <Label htmlFor='test-model'>Test Model (Optional)</Label>
            <Input
              id='test-model'
              placeholder={currentRow.test_model || 'Use default test model'}
              value={testModel}
              onChange={(e) => setTestModel(e.target.value)}
              disabled={isTesting}
            />
          </div>

          {testResult && (
            <div
              className={`rounded-md border p-4 ${
                testResult.success
                  ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/50'
                  : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/50'
              }`}
            >
              <div className='flex items-start gap-3'>
                {testResult.success ? (
                  <CheckCircle className='h-5 w-5 text-green-600 dark:text-green-400' />
                ) : (
                  <XCircle className='h-5 w-5 text-red-600 dark:text-red-400' />
                )}
                <div className='flex-1 space-y-1'>
                  <p className='text-sm font-medium'>
                    {testResult.success ? 'Test Successful' : 'Test Failed'}
                  </p>
                  {testResult.responseTime && (
                    <p className='text-sm'>
                      Response time:{' '}
                      <strong>{testResult.responseTime}ms</strong>
                    </p>
                  )}
                  {testResult.error && (
                    <p className='text-sm text-red-600 dark:text-red-400'>
                      {testResult.error}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={handleClose} disabled={isTesting}>
            Close
          </Button>
          <Button onClick={handleTest} disabled={isTesting}>
            {isTesting && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            {isTesting ? 'Testing...' : 'Test Connection'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
