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
import { Component, type ReactNode } from "react";

type ChartErrorBoundaryProps = {
  children: ReactNode;
  // Rendered in place of the chart when the chart throws.
  fallback: ReactNode;
};

type ChartErrorBoundaryState = {
  failed: boolean;
};

// Keeps a chart failure local to its panel.
//
// VChart signals a broken spec by throwing (its default onError rethrows), and
// an uncaught throw reaches the route error boundary, which swaps the whole
// page for the 500 screen. Rendering the fallback instead keeps every other
// panel of the page usable.
//
// A boundary never recovers on its own, so callers pass a key tied to the data
// driving the chart: switching that data mounts a fresh boundary, so a chart
// that works again renders again.
export class ChartErrorBoundary extends Component<
  ChartErrorBoundaryProps,
  ChartErrorBoundaryState
> {
  state: ChartErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ChartErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.error("[chart] the chart failed to render", error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
