import fs from 'node:fs';
import { join } from 'node:path';
import type { Config } from 'prebundle';

function replaceFileContent(filePath: string, replaceFn: (content: string) => string) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const newContent = replaceFn(content);
  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent);
  }
}

export default {
  prettier: true,
  dependencies: [
    // prebundle less types
    {
      name: 'less',
      dtsOnly: true,
      // bundle namespace child (hoisting) not supported yet
      beforeBundle: () => {
        replaceFileContent(
          join(process.cwd(), 'node_modules/@types/less/index.d.ts'),
          (content) =>
            `${content.replace(/declare module "less" {\s+export = less;\s+}/, 'export = Less;')}`,
        );
      },
    },
  ],
} satisfies Config;
