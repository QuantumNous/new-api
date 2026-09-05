'use client';
import * as React from 'react';
import clsx from 'clsx';
import { Tabs } from '@base-ui/react/tabs';
import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
import { useStableCallback } from '@base-ui/utils/useStableCallback';
import { usePackageManagerSnippetContext } from 'docs/src/blocks/PackageManagerSnippet/PackageManagerSnippetProvider';
import * as CodeBlock from '../CodeBlock';
import { Code } from '../Code';
import { INSTALLATION_PACKAGE_MANAGERS } from './model';
import './InstallationBlock.css';

interface InstallationBlockProps {
  package: string;
  className?: string;
}

export function InstallationBlock(props: InstallationBlockProps) {
  const { packageManager: globalPreference, setPackageManager: setGlobalPreference } =
    usePackageManagerSnippetContext();
  const [value, setValue] = React.useState<string>(INSTALLATION_PACKAGE_MANAGERS[0].value);

  useIsoLayoutEffect(() => {
    if (INSTALLATION_PACKAGE_MANAGERS.some((pm) => pm.value === globalPreference)) {
      setValue(globalPreference);
    }
  }, [globalPreference]);

  const handleValueChange = useStableCallback((newValue: string) => {
    setValue(newValue);
    setGlobalPreference(newValue);
  });

  return (
    <Tabs.Root
      className={clsx('InstallationBlock', props.className)}
      value={value}
      onValueChange={handleValueChange}
    >
      <CodeBlock.Root>
        <CodeBlock.Panel title="Installation command">
          <Tabs.List
            className="InstallationBlockTabsList"
            aria-label="Package manager"
            activateOnFocus
          >
            {INSTALLATION_PACKAGE_MANAGERS.map((pm) => (
              <Tabs.Tab key={pm.value} value={pm.value} className="InstallationBlockTab">
                <span>{pm.label}</span>
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </CodeBlock.Panel>

        {INSTALLATION_PACKAGE_MANAGERS.map((pm) => (
          <Tabs.Panel key={pm.value} value={pm.value} className="InstallationBlockTabPanel">
            <CodeBlock.Pre>
              <Code className="language-bash">
                <span className="frame">
                  <span className="line">
                    <span className="pl-en">{pm.value}</span>{' '}
                    <span className="pl-smi">{pm.command}</span>{' '}
                    <span className="pl-s">{props.package}</span>
                  </span>
                </span>
              </Code>
            </CodeBlock.Pre>
          </Tabs.Panel>
        ))}
      </CodeBlock.Root>
    </Tabs.Root>
  );
}
