import {
  createArc,
  createArea,
  createGlyph,
  createGraphic,
  createGroup,
  createImage,
  createLine,
  createPath,
  createPolygon,
  createRect,
  createRichText,
  createSymbol,
  createText,
  graphicCreator
} from '@visactor/vrender-core/graphic/creator';
import { vglobal } from '@visactor/vrender-core/global';
import { CustomPath2D } from '@visactor/vrender-core/path';
import { registerHtmlAttributePlugin, registerReactAttributePlugin } from '@visactor/vrender-core/plugin/attribute';
import { registerAnimate as registerVRenderAnimate } from '@visactor/vrender-animate/register';
import { registerArc } from '@visactor/vrender-kits/register/register-arc';
import { registerArc3d } from '@visactor/vrender-kits/register/register-arc3d';
import { registerArea } from '@visactor/vrender-kits/register/register-area';
import { registerGlyph } from '@visactor/vrender-kits/register/register-glyph';
import { registerGroup } from '@visactor/vrender-kits/register/register-group';
import { registerImage } from '@visactor/vrender-kits/register/register-image';
import { registerLine } from '@visactor/vrender-kits/register/register-line';
import { registerPath } from '@visactor/vrender-kits/register/register-path';
import { registerPolygon } from '@visactor/vrender-kits/register/register-polygon';
import { registerPyramid3d } from '@visactor/vrender-kits/register/register-pyramid3d';
import { registerRect } from '@visactor/vrender-kits/register/register-rect';
import { registerRect3d } from '@visactor/vrender-kits/register/register-rect3d';
import { registerRichtext } from '@visactor/vrender-kits/register/register-richtext';
import { registerShadowRoot } from '@visactor/vrender-kits/register/register-shadowRoot';
import { registerSymbol } from '@visactor/vrender-kits/register/register-symbol';
import { registerText } from '@visactor/vrender-kits/register/register-text';
import type {
  IArc3d,
  IArc3dGraphicAttribute,
  IPyramid3d,
  IPyramid3dGraphicAttribute,
  IRect3d,
  IRect3dGraphicAttribute,
  IStage
} from '@visactor/vrender-core';

export {
  createArc,
  createArea,
  createGlyph,
  createGraphic,
  createGroup,
  createImage,
  createLine,
  createPath,
  createPolygon,
  createRect,
  createRichText,
  createSymbol,
  createText,
  graphicCreator,
  CustomPath2D,
  registerHtmlAttributePlugin,
  registerReactAttributePlugin,
  registerVRenderAnimate,
  registerArc,
  registerArc3d,
  registerArea,
  registerGlyph,
  registerGroup,
  registerImage,
  registerLine,
  registerPath,
  registerPolygon,
  registerPyramid3d,
  registerRect,
  registerRect3d,
  registerRichtext,
  registerShadowRoot,
  registerSymbol,
  registerText,
  vglobal
};

export const createArc3d = (attributes: IArc3dGraphicAttribute): IArc3d => {
  registerArc3d();
  return createGraphic('arc3d', attributes) as IArc3d;
};

export const createPyramid3d = (attributes: IPyramid3dGraphicAttribute): IPyramid3d => {
  registerPyramid3d();
  return createGraphic('pyramid3d', attributes) as IPyramid3d;
};

export const createRect3d = (attributes: IRect3dGraphicAttribute): IRect3d => {
  registerRect3d();
  return createGraphic('rect3d', attributes) as IRect3d;
};

export const waitForAllSubLayers = (stage: IStage) =>
  new Promise(resolve => {
    vglobal.getRequestAnimationFrame()(() => {
      resolve(null);
    });
  }).then(() => {
    const promiseList: Promise<null>[] = [];
    const layers = stage.getChildren();

    layers.forEach((layer: any) => {
      if (!layer.subLayers?.size) {
        return;
      }

      layer.subLayers.forEach((subLayer: any) => {
        const drawContribution = subLayer.drawContribution;
        if (drawContribution?.hooks && drawContribution.rendering) {
          promiseList.push(
            new Promise(resolve => {
              drawContribution.hooks.completeDraw.tap('outWait', () => {
                drawContribution.hooks.completeDraw.taps = drawContribution.hooks.completeDraw.taps.filter(
                  (item: { name: string }) => item.name !== 'outWait'
                );
                resolve(null);
              });
            })
          );
        }
      });
    });

    return Promise.all(promiseList);
  });
