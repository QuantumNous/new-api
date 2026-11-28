import type { BaseLayer } from '../layer/base';
import { ModelSet } from './model-set';
import { StageModel } from './stage-model';

export abstract class LayerContainer extends StageModel {
  /** 依据 zIndex 索引的 layer */
  layerLevel: Record<string, BaseLayer[]> = {};
  /** 依据 id 索引的 layer */
  layers: ModelSet<BaseLayer> = new ModelSet();

  addLayer(layer: BaseLayer) {
    const key = layer.zIndex.toString();
    if (!this.layerLevel[key]) {
      this.layerLevel[key] = [];
    }
    if (!this.layerLevel[key].includes(layer)) {
      this.layerLevel[key].push(layer);
      this.layers.add(layer);
    }
  }

  getLayer(id: number): BaseLayer {
    return this.layers.getById(id);
  }

  getLayers(sorted?: boolean): BaseLayer[] {
    const keys = Object.keys(this.layerLevel);
    if (sorted) {
      keys.sort((a, b) => Number.parseFloat(a) - Number.parseFloat(b));
    }
    return keys.reduce((list, cur) => list.concat(this.layerLevel[cur]), [] as BaseLayer[]);
  }

  removeLayer(layer: BaseLayer) {
    const key = layer.zIndex.toString();
    const index = this.layerLevel[key].indexOf(layer);
    this.layerLevel[key].splice(index, 1);
    this.layers.delete(layer);
  }
}
