import { exec } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@e2e/helper';
import fse from 'fs-extra';

const distFile = path.join(import.meta.dirname, 'node_modules/hooksTempFile');

test('should run onExit hook before process exit', async () => {
  await fse.remove(distFile);

  await new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      childProcess.kill();
      reject(new Error('Process timeout'));
    }, 3000);

    const childProcess = exec('node ./run.js', { cwd: import.meta.dirname }, (error) => {
      if (error) {
        clearTimeout(timeoutId);
        reject(error);
        return;
      }

      try {
        expect(fs.readFileSync(distFile, 'utf-8')).toEqual('0');
        clearTimeout(timeoutId);
        resolve();
      } catch (err) {
        clearTimeout(timeoutId);
        reject(err);
      }
    });
  });
});
