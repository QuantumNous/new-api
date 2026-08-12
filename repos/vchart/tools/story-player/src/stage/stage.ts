import { LayerContainer } from '../common/layer-container';
import { ModelSet } from '../common/model-set';
import { PLAYER_PREFIX } from '../constant';
import type { IStageModelContext } from '../interface';
import type { BaseLayer } from '../layer/base';
import type { Page } from '../page';
import { createElement, createElementClassName, getElementIdByClassName } from '../utils/dom';

export class Stage extends LayerContainer {
  container: HTMLDivElement;
  currentPages: ModelSet<Page> = new ModelSet();

  constructor(context: IStageModelContext) {
    super({ name: 'stage' }, context);

    this.container = createElement('div', [`${PLAYER_PREFIX}-stage`, createElementClassName(this.id)], {
      position: 'absolute',
      top: '0px',
      left: '0px',
      width: context.width + 'px',
      height: context.height + 'px',
      overflow: 'hidden',
    });
    this.context.parentEl.appendChild(this.container);
  }

  addPage(page: Page) {
    this.currentPages.add(page);

    // layer diff
    const pageLayers = page.getLayers();
    const stageLayers = this.getLayers();
    const pageNewLayers = pageLayers.filter((layer) => !stageLayers.includes(layer));

    pageNewLayers.forEach((layer) => {
      this.addLayer(layer);
    });
  }

  removePage(page: Page) {
    this.currentPages.delete(page);

    // layer diff
    const pageLayers = page.getLayers();
    const otherPageLayers: Set<BaseLayer> = new Set();
    this.currentPages.forEach((page) =>
      page.getLayers().forEach((layer) => {
        otherPageLayers.add(layer);
      }),
    );
    pageLayers.forEach((layer) => {
      if (otherPageLayers.has(layer)) {
        layer.actions.forEach((action) => {
          if (action.pages.every((page) => !this.currentPages.has(page))) {
            action.release();
          }
        });
      } else {
        this.removeLayer(layer);
      }
    });
  }

  addLayer(layer: BaseLayer) {
    super.addLayer(layer);
    this._syncLayers();
  }

  removeLayer(layer: BaseLayer) {
    super.removeLayer(layer);
    this._syncLayers();
  }

  protected _syncLayers() {
    const layers = this.getLayers(true);
    // layer id 列表
    const layerIndexedList = layers.map((layer) => layer.id);
    // 和 layer id 一一对应的 dom 列表，有空位
    const domIndexedList: (Element | undefined)[] = Array(layerIndexedList.length).fill(undefined);
    const existDomList: Element[] = [];

    Array.from(this.container.children).forEach((domChild) => {
      const id = getElementIdByClassName(domChild);
      if (!id) {
        this.container.removeChild(domChild); // 删除非法 dom
        return;
      }
      const index = layerIndexedList.indexOf(id);
      if (index < 0) {
        const layer = this.context.player.getLayer(id);
        layer.release(); // 删除不再存在的 layer
        return;
      }
      domIndexedList[index] = domChild;
      existDomList.push(domChild);
    });

    // 插入新 layer
    let ptr = 0;
    domIndexedList.forEach((dom, i) => {
      if (!dom) {
        const layer = layers[i];
        layer.create();
        const newNode = layer.getDomNode();
        if (newNode) {
          if (ptr < existDomList.length) {
            this.container.insertBefore(newNode, existDomList[ptr]);
          } else {
            this.container.appendChild(newNode);
          }
          layer.show();
        }
      } else {
        ptr++;
      }
    });
  }

  release(): void {
    this.layers.releaseAll();
    this.currentPages.clear();
    this.container.remove();
  }
}
