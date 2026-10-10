'use client';
import * as React from 'react';
import { Tabs } from '@base-ui/react/tabs';
import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
import { usePackageManagerSnippetContext } from './PackageManagerSnippetProvider';

export function PackageManagerSnippetRoot(props: PackageManagerSnippetRoot.Props) {
  const { children, options, renderTab, renderTabsList } = props;

  const { packageManager: globalPreference, setPackageManager: setGlobalPreference } =
    usePackageManagerSnippetContext();

  const [value, setValue] = React.useState(options[0].value);

  const handleValueChange = React.useCallback(
    (newValue: string) => {
      setGlobalPreference(newValue);
    },
    [setGlobalPreference],
  );

  useIsoLayoutEffect(() => {
    if (options.some((option) => option.value === globalPreference)) {
      setValue(globalPreference);
    }
  }, [options, globalPreference]);

  return (
    <Tabs.Root value={value} onValueChange={handleValueChange}>
      <Tabs.List render={renderTabsList} aria-label="Package manager selector">
        {options.map((option) => (
          <Tabs.Tab key={option.value} value={option.value} render={renderTab}>
            {option.label}
          </Tabs.Tab>
        ))}
      </Tabs.List>
      {children}
    </Tabs.Root>
  );
}

export namespace PackageManagerSnippetRoot {
  export type Props = {
    children: React.ReactNode;
    options: Array<{ value: string; label: string }>;
    renderTab?: Tabs.Tab.Props['render'];
    renderTabsList?: Tabs.List.Props['render'];
  };
}
