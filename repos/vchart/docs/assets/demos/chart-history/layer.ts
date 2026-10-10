import type { BaseLayer, DomLayer, Player, VRenderLayer } from '@internal/story-player';
// eslint-disable-next-line no-duplicate-imports
import { LayerType } from '@internal/story-player';

export const createLayers = (player: Player, layerMap: Record<string, BaseLayer>) => {
  layerMap.layerBg2 = player.createLayer<DomLayer>(LayerType.dom, {
    zIndex: -2,
    name: 'bg2',
    defaultStyle: {
      background: '#fff'
    }
  });

  layerMap.layerBg1 = player.createLayer<DomLayer>(LayerType.dom, {
    zIndex: -1,
    name: 'bg1'
  });

  layerMap.layerVRender = player.createLayer<VRenderLayer>(LayerType.vrender, {
    zIndex: 1,
    name: 'vrender'
  });

  layerMap.layerDom = player.createLayer<DomLayer>(LayerType.dom, {
    zIndex: 2,
    name: 'dom'
  });

  layerMap.layerDom3d = player.createLayer<DomLayer>(LayerType.dom, {
    zIndex: 3,
    name: 'dom3d',
    defaultStyle: {
      perspective: '1000px'
    }
  });

  layerMap.layerChart = player.createLayer<DomLayer>(LayerType.dom, {
    zIndex: 4,
    name: 'chart'
  });

  layerMap.layerBgMask = player.createLayer<DomLayer>(LayerType.dom, {
    zIndex: 90,
    name: 'bgMask'
  });

  layerMap.layerTopChart = player.createLayer<DomLayer>(LayerType.dom, {
    zIndex: 91,
    name: 'dom'
  });

  layerMap.layerTimeline = player.createLayer<VRenderLayer>(LayerType.vrender, {
    zIndex: 100,
    name: 'vrender'
  });
};
