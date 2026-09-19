'use client';
import * as React from 'react';
import { createCodeSandbox } from 'docs/src/blocks/createCodeSandbox/createCodeSandbox';
import { DemoFile } from 'docs/src/blocks/Demo';
import { resolveDependencies } from 'docs/src/utils/demoExportOptions';
import { Button } from './Button';

export function SandboxLink(props: SandboxLinkProps) {
  const { files, ...otherProps } = props;

  const handleClick = React.useCallback(() => {
    createCodeSandbox({
      demoFiles: files,
      demoLanguage: 'ts',
      title: 'Base UI experiment',
      dependencies: {
        react: '^19',
        'react-dom': '^19',
      },
      devDependencies: {
        '@types/react': '^19',
        '@types/react-dom': '^19',
        'react-scripts': 'latest',
      },
      dependencyResolver: resolveDependencies,
      customIndexFile: indexTs,
    });
  }, [files]);

  return (
    <Button {...otherProps} onClick={handleClick} variant="text" fullWidth>
      Open in CodeSandbox
    </Button>
  );
}

const indexTs = `import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import Experiment, { settingsMetadata } from './App';
import { SettingsPanel, ExperimentSettingsProvider } from './SettingsPanel';

ReactDOM.createRoot(document.querySelector("#root")!).render(
  <React.StrictMode>
    <ExperimentSettingsProvider metadata={settingsMetadata}>
      <Experiment />
      <SettingsPanel metadata={settingsMetadata} />
    </ExperimentSettingsProvider>
  </React.StrictMode>
);`;

interface SandboxLinkProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  files: DemoFile[];
}
