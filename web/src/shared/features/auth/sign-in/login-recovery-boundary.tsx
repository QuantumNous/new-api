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
import { Component, Fragment, type ErrorInfo, type ReactNode } from 'react'

import { LoginError } from '@/shared/features/errors/login-error'

import { clearStaleLoginState } from '../lib/login-recovery'

type LoginRecoveryBoundaryProps = {
  children: ReactNode
}

type LoginRecoveryBoundaryState = {
  failed: boolean
  attempt: number
}

/**
 * Keeps a corrupt local state from blanking the whole sign-in page.
 *
 * The first rendering error wipes stale client auth state and remounts the form
 * once with a clean store. If the remount also throws, the regular login error
 * screen is shown instead of retrying forever.
 */
export class LoginRecoveryBoundary extends Component<
  LoginRecoveryBoundaryProps,
  LoginRecoveryBoundaryState
> {
  state: LoginRecoveryBoundaryState = { failed: false, attempt: 0 }

  static getDerivedStateFromError(): Partial<LoginRecoveryBoundaryState> {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    clearStaleLoginState()

    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error('[login] recovered from a rendering error', error, info)
    }

    if (this.state.attempt === 0) {
      this.setState({ failed: false, attempt: 1 })
    }
  }

  render(): ReactNode {
    if (this.state.failed) return <LoginError />

    return <Fragment key={this.state.attempt}>{this.props.children}</Fragment>
  }
}
