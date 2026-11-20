'use client';
import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
import * as React from 'react';

export interface PackageManagerSnippetContext {
  packageManager: string;
  setPackageManager: (variant: string) => void;
}

export const PackageManagerSnippetContext =
  React.createContext<PackageManagerSnippetContext | null>(null);

export const usePackageManagerSnippetContext = () => {
  const context = React.useContext(PackageManagerSnippetContext);
  if (!context) {
    throw new Error('Missing PackageManagerSnippetContext');
  }

  return context;
};

interface PackageManagerSnippetProviderProps {
  children: React.ReactNode;
  defaultValue: string;
}

const STORAGE_KEY = 'preferredPackageManager';

export function PackageManagerSnippetProvider(props: PackageManagerSnippetProviderProps) {
  const { children, defaultValue } = props;
  const [value, setValue] = React.useState(defaultValue);

  const handleValueChange = React.useCallback((newValue: string) => {
    setValue(newValue);
    localStorage.setItem(STORAGE_KEY, newValue);
  }, []);

  useIsoLayoutEffect(() => {
    const savedValue = localStorage.getItem(STORAGE_KEY);

    if (savedValue) {
      setValue(savedValue);
    }
  }, []);

  const contextValue = React.useMemo(
    () => ({
      packageManager: value,
      setPackageManager: handleValueChange,
    }),
    [value, handleValueChange],
  );

  return (
    <PackageManagerSnippetContext.Provider value={contextValue}>
      {children}
    </PackageManagerSnippetContext.Provider>
  );
}
