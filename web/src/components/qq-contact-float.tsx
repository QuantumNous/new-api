import { useEffect, useRef, useState } from 'react'
import { MessageCircle, X } from 'lucide-react'

import { cn } from '@/lib/utils'

export function QqContactFloat() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Close when clicking / tapping outside the widget
  // pointerdown unifies mouse + touch, avoiding the mousedown+touchstart double-fire on touch devices
  useEffect(() => {
    if (!open) return
    const handleOutside = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', handleOutside)
    return () => document.removeEventListener('pointerdown', handleOutside)
  }, [open])

  // Close on Escape key
  useEffect(() => {
    if (!open) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [open])

  // Move focus into dialog when opened; return focus to trigger button when closed
  useEffect(() => {
    if (open) {
      dialogRef.current?.focus()
    } else {
      buttonRef.current?.focus()
    }
  }, [open])

  return (
    <div
      ref={containerRef}
      className='fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2'
    >
      {open && (
        <div
          ref={dialogRef}
          role='dialog'
          aria-modal='true'
          aria-label='客服QQ群二维码'
          tabIndex={-1}
          className={cn(
            'max-w-[calc(100vw-3rem)] rounded-xl border bg-card p-3 shadow-xl',
            'focus:outline-none'
          )}
        >
          <p className='mb-2 text-center text-sm font-medium text-card-foreground'>
            扫码加入客服QQ群
          </p>
          <img
            src='/qq-contact.png'
            alt='客服QQ群二维码'
            width={1284}
            height={2289}
            className='w-44 rounded-lg sm:w-52'
          />
        </div>
      )}

      <button
        ref={buttonRef}
        type='button'
        onClick={() => setOpen((v) => !v)}
        aria-label='联系客服'
        aria-expanded={open}
        aria-haspopup='dialog'
        className={cn(
          'flex size-12 items-center justify-center rounded-full shadow-lg',
          'bg-primary text-primary-foreground transition-colors hover:bg-primary/90',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
        )}
      >
        {open ? (
          <X className='size-5' aria-hidden='true' />
        ) : (
          <MessageCircle className='size-5' aria-hidden='true' />
        )}
      </button>
    </div>
  )
}
