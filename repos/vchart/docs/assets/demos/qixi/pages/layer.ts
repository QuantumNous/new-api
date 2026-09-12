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

  layerMap.layerChart = player.createLayer<DomLayer>(LayerType.dom, {
    zIndex: 3,
    name: 'chart'
  });

  layerMap.layerVideo = player.createLayer<DomLayer>(LayerType.dom, {
    zIndex: 4,
    name: 'video'
  });

  layerMap.layerText = player.createLayer<DomLayer>(LayerType.dom, {
    zIndex: 5,
    name: 'text'
  });

  layerMap.layerBgMask = player.createLayer<DomLayer>(LayerType.dom, {
    zIndex: 90,
    name: 'bgMask'
  });
};
