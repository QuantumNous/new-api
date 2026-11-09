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
import { Component, type ErrorInfo, type ReactNode } from 'react'

import { ErrorState } from '@/shared/components/error-state'

type ClientErrorBoundaryProps = {
  children: ReactNode
}

type ClientErrorBoundaryState = {
  error: Error | null
}

/**
 * Last line of defence for the client portal.
 *
 * A render crash inside the portal shell (or inside a lazily loaded page)
 * unmounts the whole React tree, which leaves the browser on an empty
 * background — the "black screen" report. This boundary keeps the failure
 * inside the portal and renders a recoverable fallback instead.
 *
 * The router's own `errorComponent` only covers errors raised while a route
 * is resolving; it does not cover crashes thrown by components that render
 * outside a route boundary (the shared shell) nor by lazily loaded pages that
 * fail after the route resolved.
 */
export class ClientErrorBoundary extends Component<
  ClientErrorBoundaryProps,
  ClientErrorBoundaryState
> {
  state: ClientErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ClientErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('[client] render crashed', error, info.componentStack)
  }

  handleRetry = (): void => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    const { error } = this.state
    if (error == null) return this.props.children

    return (
      <ErrorState
        className='min-h-svh'
        onRetry={this.handleRetry}
        description={error.message}
      />
    )
  }
}
