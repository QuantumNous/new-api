import type { Maybe } from '@visactor/vutils';
import type { IStageModelContext } from '../interface';
import type { ILayerConfig, LayerType } from './interface';
import type { Action } from '../action/action';
import { StageModel } from '../common/stage-model';
import { ModelSet } from '../common/model-set';

export abstract class BaseLayer extends StageModel {
  abstract type: LayerType;
  zIndex = 0;
  declare config: ILayerConfig;

  actions: ModelSet<Action<any>> = new ModelSet();

  isCreated = false;
  isShown = false;

  abstract getDomNode(): Maybe<HTMLElement>;

  constructor(config: ILayerConfig, context: IStageModelContext) {
    super(config, context);
    this.zIndex = config.zIndex ?? 0;
  }

  protected abstract _create(): void;
  protected abstract _show(): void;
  protected abstract _hide(): void;
  protected abstract _release(): void;

  create(): void {
    if (this.isCreated) {
      return;
    }
    this._create();
    this.isCreated = true;
  }

  show(): void {
    if (!this.getDomNode() || this.isShown) {
      return;
    }
    this._show();
    this.isShown = true;
  }

  hide(): void {
    if (!this.getDomNode() || !this.isShown) {
      return;
    }
    this._hide();
    this.isShown = false;
  }

  release(): void {
    if (!this.getDomNode() || !this.isCreated) {
      return;
    }
    this.actions.releaseAll();
    this._release();
    this.isCreated = false;
    this.isShown = false;
  }
}
