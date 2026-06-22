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
  opsConsoleCardClassName,
  opsConsoleMutedLabelClassName,
  opsConsoleOutlineButtonClassName,
} from '@/lib/ops-ui-styles'

export const walletCardClassName = cn(opsConsoleCardClassName, 'py-0')

export const walletOutlineButtonClassName = opsConsoleOutlineButtonClassName

export const walletMutedLabelClassName = opsConsoleMutedLabelClassName

export const walletMutedTextClassName = 'text-xs text-slate-500'

export const walletBodyTextClassName = 'text-sm text-slate-700'

export const walletStatInsetClassName = cn(
  'rounded-lg border border-[#DBEAFE] bg-[#F8FBFF] px-2 py-2'
)

export const walletDialogDescriptionClassName = 'text-sm text-slate-500'

export const walletDialogMutedLabelClassName = walletMutedLabelClassName

export const walletPresetOptionSelectedClassName = cn(
  'border-blue-500 bg-blue-50 ring-1 ring-blue-200/70'
)

export const walletPresetOptionClassName = cn(
  'border-[#DBEAFE] bg-white hover:border-blue-200 hover:bg-blue-50/50'
)

export const walletAlertInfoClassName =
  'border-amber-200 bg-amber-50 text-slate-800'

export const walletIconMutedClassName = 'size-4 text-slate-500'

export const walletLinkClassName =
  'inline-flex items-center gap-1 text-slate-800 underline-offset-4 hover:text-blue-700 hover:underline'
