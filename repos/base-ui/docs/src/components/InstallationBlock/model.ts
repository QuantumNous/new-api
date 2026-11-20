export const INSTALLATION_PACKAGE_MANAGERS = [
  { value: 'pnpm', label: 'pnpm', command: 'add' },
  { value: 'npm', label: 'npm', command: 'i' },
  { value: 'yarn', label: 'yarn', command: 'add' },
  { value: 'bun', label: 'bun', command: 'add' },
] as const;

export type InstallationPackageManager = (typeof INSTALLATION_PACKAGE_MANAGERS)[number];

export function getInstallCommand(packageManager: InstallationPackageManager, packageName: string) {
  return `${packageManager.value} ${packageManager.command} ${packageName}`;
}
