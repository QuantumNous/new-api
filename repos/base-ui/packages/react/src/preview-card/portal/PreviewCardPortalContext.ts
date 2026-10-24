'use client';
import * as React from 'react';

export const PreviewCardPortalContext = React.createContext<boolean | undefined>(undefined);

export function usePreviewCardPortalContext() {
  const value = React.useContext(PreviewCardPortalContext);
  if (value === undefined) {
    throw new Error('Base UI: <PreviewCard.Portal> is missing.');
  }
  return value;
}
