import { Snippet } from '@/components/docs/snippet';
import { Tab, Tabs } from '@/components/docs/tabs';

const managers = [
  { label: 'pnpm', command: 'pnpm add', devCommand: 'pnpm add -D' },
  { label: 'npm', command: 'npm install', devCommand: 'npm install -D' },
  { label: 'yarn', command: 'yarn add', devCommand: 'yarn add -D' },
  { label: 'bun', command: 'bun add', devCommand: 'bun add -d' },
];

export const InstallPackages = ({
  packages,
  dev = false,
}: {
  packages: string;
  dev?: boolean;
}) => (
  <Tabs items={managers.map(manager => manager.label)} label="Package manager">
    {managers.map(manager => (
      <Tab key={manager.label}>
        <Snippet
          text={`${dev ? manager.devCommand : manager.command} ${packages}`}
        />
      </Tab>
    ))}
  </Tabs>
);
