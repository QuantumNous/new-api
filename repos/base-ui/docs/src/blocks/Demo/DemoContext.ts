'use client';
import * as React from 'react';
import { DemoFile, DemoVariant } from './types';

export interface DemoContext {
  selectedFile: DemoFile;
  selectedVariant: DemoVariant;
  setSelectedFile: (file: DemoFile) => void;
  setSelectedVariant: (variant: DemoVariant) => void;
  variants: DemoVariant[];
}

export const DemoContext = React.createContext<DemoContext | undefined>(undefined);

if (process.env.NODE_ENV !== 'production') {
  DemoContext.displayName = 'DemoContext';
}

export function useDemoContext() {
  const context = React.useContext(DemoContext);
  if (!context) {
    throw new Error('useDemoContext must be used within a DemoProvider');
  }
  return context;
}
