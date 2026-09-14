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
import { Link } from '@tanstack/react-router'

import { useTheme } from '@/context/theme-provider'
import { CiMark } from '@/features/home/components/ci-mark'
import { PRODUCT_NAME } from '@/lib/product-brand'

import { CommunityHelp } from './community-help'

type CiStatusPageProps = {
  code?: string | number
  title: string
  description: React.ReactNode
  actions?: React.ReactNode
}

export function CiStatusPage(props: CiStatusPageProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  return (
    <div className='ci-landing ci-theme' data-theme={isDark ? 'dark' : 'light'}>
      <header className='ci-header'>
        <div className='ci-headerInner'>
          <Link to='/' className='ci-logo' aria-label={`${PRODUCT_NAME} home`}>
            <CiMark size={22} withWordmark />
          </Link>
          <CommunityHelp variant='header' />
        </div>
      </header>
      <main className='ci-appPage' style={{ textAlign: 'center' }}>
        <p className='ci-appCrumb'>{PRODUCT_NAME}</p>
        {props.code != null ? (
          <h1
            style={{
              margin: '0 0 12px',
              fontFamily: 'var(--ci-font-display)',
              fontSize: 'clamp(4rem, 12vw, 7rem)',
              fontStyle: 'italic',
              fontWeight: 400,
              letterSpacing: '-0.06em',
              lineHeight: 0.9,
            }}
          >
            {props.code}
          </h1>
        ) : null}
        <h2
          style={{
            margin: '0 0 10px',
            fontFamily: 'var(--ci-font-display)',
            fontSize: '2rem',
            fontStyle: 'italic',
            fontWeight: 400,
          }}
        >
          {props.title}
        </h2>
        <div
          style={{
            color: 'var(--ci-color-text-muted)',
            fontSize: 15,
            lineHeight: 1.5,
          }}
        >
          {props.description}
        </div>
        {props.actions ? (
          <div
            className='ci-appPageActions'
            style={{ justifyContent: 'center', marginTop: 24 }}
          >
            {props.actions}
          </div>
        ) : null}
      </main>
    </div>
  )
}
