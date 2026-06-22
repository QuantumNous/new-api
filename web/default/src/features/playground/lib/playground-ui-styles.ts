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
import {
  opsConsoleOutlineButtonClassName,
  opsConsolePrimaryButtonClassName,
} from '@/lib/ops-ui-styles'

/** Playground / capability test bench — light ops console scope. */
export const playgroundShellClassName = cn(
  'min-h-full text-slate-800',
  '[&_[class*="text-muted-foreground"]]:text-slate-500',
  '[&_.text-foreground]:text-slate-900',
  '[&_.group.is-assistant]:text-slate-800',
  '[&_.group.is-user_.text-foreground]:text-slate-900',
  '[&_[data-streamdown]]:text-slate-800',
  '[&_.prose]:text-slate-800',
  '[&_.prose_p]:text-slate-800 [&_.prose_li]:text-slate-700 [&_.prose_code]:text-slate-800',
  '[&_.prose_pre]:bg-slate-100 [&_.prose_pre]:text-slate-800'
)

export const playgroundAssistantMessageClassName = cn(
  'text-slate-800',
  '[&_[data-streamdown]]:text-slate-800',
  '[&_.prose]:text-slate-800'
)

export const playgroundUserMessageClassName = cn(
  'border border-[#DBEAFE] bg-blue-50 text-slate-900'
)

export const playgroundEditTextareaClassName = cn(
  'border-[#DBEAFE] bg-white text-slate-900',
  'placeholder:text-slate-400',
  'focus-visible:border-blue-400 focus-visible:ring-blue-400/25'
)

export const playgroundSaveButtonClassName = opsConsolePrimaryButtonClassName

export const playgroundSaveSubmitButtonClassName = cn(
  'border-emerald-600 bg-emerald-600 text-white hover:border-emerald-700 hover:bg-emerald-700',
  'disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400'
)

export const playgroundCancelButtonClassName = opsConsoleOutlineButtonClassName

export const playgroundPromptInputGroupClassName = cn(
  'border-[#DBEAFE] bg-white shadow-md shadow-blue-950/5',
  'ring-1 ring-blue-100/80'
)

export const playgroundPromptTextareaClassName = cn(
  'text-slate-900 placeholder:text-slate-400'
)

export const playgroundPromptOutlineButtonClassName = opsConsoleOutlineButtonClassName

export const playgroundPromptSendButtonClassName = opsConsolePrimaryButtonClassName

export const playgroundInputDockClassName = cn(
  'shrink-0 border-t border-[#DBEAFE] bg-white/95 backdrop-blur-md',
  'shadow-[0_-4px_24px_-8px_rgba(15,23,42,0.08)]'
)

export const playgroundMessageActionButtonClassName = cn(
  'size-7 text-slate-500 hover:bg-blue-50 hover:text-blue-700',
  'disabled:text-slate-300'
)

export const playgroundMessageActionDeleteClassName = cn(
  'size-7 text-slate-500 hover:bg-rose-50 hover:text-rose-600',
  'disabled:text-slate-300'
)

export const playgroundDialogTitleClassName = 'text-base font-semibold text-slate-900'

export const playgroundDialogDescriptionClassName = 'text-sm text-slate-600'

export const playgroundEmptyStateClassName = cn(
  'flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed',
  'border-[#DBEAFE] bg-white/80 px-6 py-10 text-center'
)
