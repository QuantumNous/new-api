import { exec } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { CREATE_RSBUILD_BIN_PATH, expect } from '@e2e/helper';
import fse from 'fs-extra';

export const expectPackageJson = (
  pkgJson: Record<string, any>,
  name: string,
  expectedBuildScript = 'rsbuild build',
) => {
  expect(pkgJson.name).toBe(name);
  expect(pkgJson.scripts.dev).toBe('rsbuild --open');
  expect(pkgJson.scripts.build).toBe(expectedBuildScript);
  expect(pkgJson.devDependencies['@rsbuild/core']).toBeTruthy();
};

export const createAndValidate = async (
  cwd: string,
  template: string,
  {
    name = `test-temp-${template}`,
    tools = [],
    clean = true,
    expectedBuildScript,
  }: {
    name?: string;
    tools?: string[];
    clean?: boolean;
    expectedBuildScript?: string;
  } = {},
) => {
  const dir = path.join(cwd, name);
  await fse.remove(dir);

  let command = `node ${CREATE_RSBUILD_BIN_PATH} ${name} -t ${template}`;
  if (tools.length) {
    const toolsCmd = tools.map((tool) => `--tools ${tool}`).join(' ');
    command += ` ${toolsCmd}`;
  }

  await new Promise<void>((resolve, reject) => {
    exec(command, { cwd }, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });

  const pkgJson = await fse.readJSON(path.join(dir, 'package.json'));
  expectPackageJson(pkgJson, path.basename(name), expectedBuildScript);

  if (template.endsWith('-ts')) {
    expect(pkgJson.devDependencies.typescript).toBeTruthy();
    try {
      await access(path.join(dir, 'tsconfig.json'));
      expect(true).toBeTruthy();
    } catch {
      expect(false).toBeTruthy();
    }
  }

  const cleanFn = async () => await fse.remove(dir);
  if (clean) {
    await cleanFn();
  }

  return { dir, pkgJson, clean: cleanFn };
};
