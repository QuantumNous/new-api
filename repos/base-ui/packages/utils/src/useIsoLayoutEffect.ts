'use client';
import * as React from 'react';

const noop = () => {};

export const useIsoLayoutEffect = typeof document !== 'undefined' ? React.useLayoutEffect : noop;
