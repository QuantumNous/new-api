/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { cn } from '@/lib/utils'

/** Playground / capability test bench dark-theme readability scope. */
export const playgroundShellClassName = cn(
  'dark min-h-full text-slate-100',
  '[&_[class*="text-muted-foreground"]]:text-slate-300',
  '[&_.text-foreground]:text-slate-50',
  '[&_.group.is-assistant]:text-slate-100',
  '[&_.group.is-user_.text-foreground]:text-slate-50',
  '[&_[data-streamdown]]:text-slate-100',
  '[&_.prose]:prose-invert [&_.prose]:text-slate-100',
  '[&_.prose_p]:text-slate-100 [&_.prose_li]:text-slate-100 [&_.prose_code]:text-slate-100',
  '[&_[data-slot=input-group]]:border-white/20 [&_[data-slot=input-group]]:bg-slate-900/90',
  '[&_[data-slot=input-group-input]]:text-slate-50 [&_[data-slot=input-group-input]::placeholder]:text-slate-400',
  '[&_[data-slot=input-group-button]]:text-slate-200',
  '[&_[data-slot=input-group-button]:hover]:bg-white/10 [&_[data-slot=input-group-button]:hover]:text-white',
  '[&_[data-slot=input-group-button][disabled]]:text-slate-500 [&_[data-slot=input-group-button][disabled]]:opacity-70'
)

export const playgroundAssistantMessageClassName = cn(
  'text-slate-100',
  '[&_[data-streamdown]]:text-slate-100',
  '[&_.prose]:prose-invert [&_.prose]:text-slate-100'
)

export const playgroundUserMessageClassName = cn(
  'bg-slate-800 text-slate-50',
  'dark:bg-slate-800 dark:text-slate-50'
)

export const playgroundEditTextareaClassName = cn(
  'border-white/20 bg-slate-950/90 text-slate-50',
  'placeholder:text-slate-400',
  'focus-visible:border-cyan-400/50 focus-visible:ring-cyan-400/25'
)

export const playgroundSaveButtonClassName = cn(
  'bg-cyan-600 text-white hover:bg-cyan-500',
  'disabled:bg-slate-700 disabled:text-slate-400'
)

export const playgroundSaveSubmitButtonClassName = cn(
  'bg-emerald-600 text-white hover:bg-emerald-500',
  'disabled:bg-slate-700 disabled:text-slate-400'
)

export const playgroundCancelButtonClassName = cn(
  'border-white/20 bg-slate-900/80 text-slate-100 hover:bg-slate-800 hover:text-white',
  'disabled:border-white/10 disabled:bg-slate-900/50 disabled:text-slate-500'
)

export const playgroundPromptInputGroupClassName = cn(
  'border-white/20 bg-slate-900/90 shadow-lg shadow-black/20',
  'ring-1 ring-white/10'
)

export const playgroundPromptTextareaClassName = cn(
  'text-slate-50 placeholder:text-slate-400'
)

export const playgroundPromptOutlineButtonClassName = cn(
  'border-white/20 bg-slate-900/70 text-slate-100 hover:bg-white/10 hover:text-white',
  'disabled:border-white/10 disabled:text-slate-500'
)

export const playgroundPromptSendButtonClassName = cn(
  'bg-cyan-600 text-white hover:bg-cyan-500',
  'disabled:bg-slate-700 disabled:text-slate-400'
)

export const playgroundMessageActionButtonClassName = cn(
  'size-7 text-slate-400 hover:bg-white/10 hover:text-slate-100',
  'disabled:text-slate-600'
)

export const playgroundMessageActionDeleteClassName = cn(
  'size-7 text-slate-400 hover:bg-rose-500/15 hover:text-rose-300',
  'disabled:text-slate-600'
)

export const playgroundDialogTitleClassName = cn(
  'text-base font-semibold text-slate-100'
)

export const playgroundDialogDescriptionClassName = cn('text-sm text-slate-400')
