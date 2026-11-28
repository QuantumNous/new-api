import fs from 'fs-extra';

export type RawPackageJson = {
  name: string;
  description?: string;
  version: string;
  main?: string;
  scripts?: Record<string, string>;
  repository?: Record<string, string>;
  devDependencies?: Record<string, string>;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  keywords?: string[];
  author?: string;
  browserslist?: string[];
  homepage?: string;
} & Record<string, unknown>;

export function loadPackageJson(absPath: string): RawPackageJson | null {
  try {
    return fs.readJsonSync(`${absPath}/package.json`, { encoding: 'utf-8' });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    return null;
  }
}

export function packageNameToPath(name: string) {
  return name.replace('@', '').replace('/', '_');
}
