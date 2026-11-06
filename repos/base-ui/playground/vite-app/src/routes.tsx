import type * as React from 'react';
import ContainedTriggers from './experiments/perf/contained-triggers';
import DetachedTriggers from './experiments/perf/detached-triggers';
import RadixTriggers from './experiments/perf/radix-triggers';

export type RouteEntry =
  | {
      type: 'route';
      path: string;
      label: string;
      element: React.ReactElement;
      showInNav?: boolean;
    }
  | {
      type: 'redirect';
      path: string;
      to: string;
    }
  | {
      type: 'header';
      label: string;
    };

export const defaultRoute = '/perf/contained-triggers';

export const routes: RouteEntry[] = [
  { type: 'header', label: 'Performance benchmarks' },
  { type: 'redirect', path: '/perf', to: defaultRoute },
  {
    type: 'route',
    path: '/perf/contained-triggers',
    label: 'Base UI contained triggers',
    element: <ContainedTriggers />,
    showInNav: true,
  },
  {
    type: 'route',
    path: '/perf/detached-triggers',
    label: 'Base UI detached triggers',
    element: <DetachedTriggers />,
    showInNav: true,
  },
  {
    type: 'route',
    path: '/perf/radix-triggers',
    label: 'Radix triggers',
    element: <RadixTriggers />,
    showInNav: true,
  },
];
