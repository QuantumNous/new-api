import type { IBasePlugin, IBasePluginService } from './interface';
import { createID } from '../../util/id';

export class BasePlugin<T extends IBasePluginService = IBasePluginService> implements IBasePlugin<T> {
  readonly id: number;
  readonly name: string;
  readonly type: string;
  protected service?: T;

  constructor(type: string) {
    this.id = createID();
    this.name = `${type}_${this.id}`;
  }

  onAdd(service: T): void {
    this.service = service;
  }

  release(): void {
    this.service = null;
  }
}
