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
import { Trans } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { SystemStatus } from '../types'

interface TermsFooterProps {
  className?: string
  status?: SystemStatus | null
}

export function TermsFooter({ className, status }: TermsFooterProps) {
  // Visibility is controlled by a dedicated admin toggle (default off), not by
  // whether the legal documents have content — the linked pages render the
  // built-in default documents when admin content is empty.
  if (!status?.auth_notice_enabled) {
    return null
  }

  return (
    <p className={cn('text-muted-foreground text-center text-xs', className)}>
      <Trans
        i18nKey='By proceeding, you agree to the <tos>Terms of Service</tos> and <pp>Privacy Policy</pp>.'
        components={{
          tos: (
            <a
              href='/terms'
              target='_blank'
              rel='noopener noreferrer'
              className='hover:text-primary underline underline-offset-4'
            />
          ),
          pp: (
            <a
              href='/privacy'
              target='_blank'
              rel='noopener noreferrer'
              className='hover:text-primary underline underline-offset-4'
            />
          ),
        }}
      />
    </p>
  )
}
