import path from 'node:path';

const fallbackPath =
  '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin';

export function prependOpenCodeBinToPath({
  bootstrapDir,
  env,
}: {
  bootstrapDir: string;
  env: NodeJS.ProcessEnv;
}): void {
  env.PATH = [
    path.join(bootstrapDir, 'node_modules', '.bin'),
    env.PATH || fallbackPath,
  ].join(path.delimiter);
}
