import type { BaseActor } from '../actor/base';
import { computeDuration } from '../utils';
import { wait } from '../utils/animate';
import type { IActConfig, IActContext } from './interface';

export async function doActs<T extends BaseActor = BaseActor>(
  configList: Array<IActConfig<T>>,
  context: IActContext<T>,
) {
  await Promise.all([wait(computeDuration(configList)), ...configList.map((config) => config.callback?.(context))]);
}
