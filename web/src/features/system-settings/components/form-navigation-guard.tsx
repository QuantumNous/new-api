import { useState, useEffect } from 'react'
import { useBlocker } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ConfirmDialog } from '@/components/confirm-dialog'

type FormNavigationGuardProps = {
  when: boolean
  title?: string
  message?: string
}

/**
 * Form navigation guard with custom dialog
 *
 * Prevents navigation when form has unsaved changes.
 * Uses project's native ConfirmDialog instead of browser's window.confirm()
 *
 * @param when - Whether to block navigation (typically form.formState.isDirty)
 * @param title - Dialog title
 * @param message - Dialog message
 *
 * @example
 * ```tsx
 * <FormNavigationGuard when={form.formState.isDirty} />
 * ```
 */
export function FormNavigationGuard({
  when,
  title = 'Unsaved changes',
  message = 'You have unsaved changes. Are you sure you want to leave?',
}: FormNavigationGuardProps) {
  const { t } = useTranslation()
  const blocker = useBlocker({ condition: when })
  const [showDialog, setShowDialog] = useState(false)

  // Listen to blocker status changes
  useEffect(() => {
    if (blocker.status === 'blocked') {
      setShowDialog(true)
    }
  }, [blocker.status])

  const handleConfirm = () => {
    setShowDialog(false)
    blocker.proceed?.()
  }

  const handleCancel = () => {
    setShowDialog(false)
    blocker.reset?.()
  }

  // Handle browser navigation (refresh, close tab)
  useEffect(() => {
    if (!when) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
      return ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [when])

  return (
    <ConfirmDialog
      open={showDialog}
      onOpenChange={(open) => {
        if (!open) handleCancel()
      }}
      title={title}
      desc={message}
      confirmText={t('Leave')}
      cancelBtnText='Stay'
      destructive
      handleConfirm={handleConfirm}
    />
  )
}
