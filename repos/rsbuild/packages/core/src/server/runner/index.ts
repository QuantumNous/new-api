/**
 * The following code is modified based on @rspack/test-tools/runner
 */
import { color } from '../../helpers';
import { EsmRunner } from './esm';
import type { Runner, RunnerFactory, RunnerFactoryOptions } from './type';

class BasicRunnerFactory implements RunnerFactory {
  constructor(protected name: string) {}

  create(options: RunnerFactoryOptions): Runner {
    const runner = this.createRunner(options);
    return runner;
  }

  protected createRunner(options: RunnerFactoryOptions): Runner {
    const runnerOptions = {
      name: this.name,
      ...options,
    };
    const { compilerOptions } = options;
    if (compilerOptions.target === 'web' || compilerOptions.target === 'webworker') {
      throw new Error(
        `${color.dim('[rsbuild:runner]')} Not support run ${color.yellow(
          compilerOptions.target,
        )} resource in Rsbuild server`,
      );
    }
    return new EsmRunner(runnerOptions);
  }
}

export const run = async <T>({
  bundlePath,
  ...runnerFactoryOptions
}: RunnerFactoryOptions & {
  bundlePath: string;
}): Promise<T> => {
  const runnerFactory = new BasicRunnerFactory(bundlePath);
  const runner = runnerFactory.create(runnerFactoryOptions);
  const mod = await runner.run(bundlePath);

  return mod as T;
};
