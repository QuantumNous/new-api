import type { IStageModelConfig, IStageModelContext } from '../interface';
import { createID } from '../utils';

export abstract class StageModel {
  name?: string;
  id: number;
  config: IStageModelConfig;
  context: IStageModelContext;

  constructor(config: IStageModelConfig, context: IStageModelContext) {
    this.id = createID();
    this.name = config.name;
    this.config = config;
    this.context = context;
  }

  abstract release(): void | Promise<void>;
}
