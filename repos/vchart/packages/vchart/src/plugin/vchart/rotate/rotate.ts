import type { IAABBBounds, Matrix } from '@visactor/vutils';
import { BasePlugin } from '../../base/base-plugin';
import type { IVChartPlugin, IVChartPluginService } from '../interface';
import { registerVChartPlugin } from '../register';
import type { IVChart } from '../../../core/interface';
import {
  matrixAllocate,
  transformPointForCanvas,
  mapToCanvasPointForCanvas,
  registerGlobalEventTransformer,
  registerWindowEventTransformer,
  vglobal
} from '@visactor/vrender-core';

export class RotatePlugin extends BasePlugin implements IVChartPlugin {
  static readonly pluginType: 'vchart' = 'vchart';

  static readonly specKey = 'rotate';

  static readonly type: string = 'rotatePlugin';
  readonly type: string = 'rotatePlugin';

  private rotateDegree: number;
  private matrix: Matrix;
  private vglobal_mapToCanvasPoint: any; // 保存vrender中vglobal的mapToCanvasPoint原方法
  private _vchart: IVChart;

  constructor() {
    super(RotatePlugin.type);
  }

  onInit(service: IVChartPluginService) {
    const { globalInstance: vchart } = service;
    if (!vchart) {
      return;
    }
    this._vchart = vchart;
    //将函数rotate90WithTransform绑定到table实例上，一般情况下插件不需要将api绑定到table实例上，可以直接自身实现某个api功能
    vchart.rotate90WithTransform = this.rotate90WithTransform;
    vchart.cancelTransform = this.cancelTransform;
  }

  rotate90WithTransform = (rotateDom: HTMLElement) => {
    this.rotateDegree = 90;
    const rotateCenter =
      rotateDom.clientWidth < rotateDom.clientHeight
        ? Math.max(rotateDom.clientWidth, rotateDom.clientHeight) / 2
        : Math.min(rotateDom.clientWidth, rotateDom.clientHeight) / 2;
    const domRect = this._vchart.getContainer().getBoundingClientRect();
    const x1 = domRect.left;
    const y1 = domRect.top;
    const x2 = domRect.right;
    const y2 = domRect.bottom;

    rotateDom.style.transform = 'rotate(90deg)';
    rotateDom.style.transformOrigin = `${rotateCenter}px ${rotateCenter}px`;
    const getRect = () => {
      return {
        x1,
        y1,
        x2,
        y2
      } as IAABBBounds;
    };
    // 获取视口尺寸的通用方法
    const getViewportDimensions = () => {
      // 浏览器环境
      if (typeof window !== 'undefined') {
        return {
          width: window.innerWidth || document.documentElement.clientWidth,
          height: window.innerHeight || document.documentElement.clientHeight
        };
      }
      // 如果有 vglobal 上的方法可以使用
      if (vglobal && 'getViewportSize' in vglobal && vglobal.getViewportSize) {
        // @ts-ignore
        return vglobal.getViewportSize();
      }
      // 默认使用容器的尺寸
      return rotateDom.getBoundingClientRect();
    };

    const getMatrix = () => {
      const viewPortWidth = getViewportDimensions().width; //获取整个视口的尺寸
      const domRect = this._vchart.getContainer().getBoundingClientRect(); //TODO 这个地方应该获取窗口的宽高 最好能从vglobal上直接获取
      const x1 = domRect.top;
      const y1 = viewPortWidth - domRect.right;

      const matrix = matrixAllocate.allocate(1, 0, 0, 1, 0, 0);
      matrix.translate(x1, y1);
      const centerX = rotateCenter - x1;
      const centerY = rotateCenter - y1;
      matrix.translate(centerX, centerY);
      matrix.rotate(Math.PI / 2);
      matrix.translate(-centerX, -centerY);
      this.matrix = matrix;
      return matrix;
    };
    registerGlobalEventTransformer(vglobal, this._vchart.getContainer(), getMatrix, getRect, transformPointForCanvas);
    registerWindowEventTransformer(
      this._vchart.getStage().window,
      this._vchart.getContainer(),
      getMatrix,
      getRect,
      transformPointForCanvas
    );
    this.vglobal_mapToCanvasPoint = vglobal.mapToCanvasPoint;
    vglobal.mapToCanvasPoint = mapToCanvasPointForCanvas;
    //transformPointForCanvas和mapToCanvasPointForCanvas时相对应的
    //具体逻辑在 VRender/packages/vrender-core/src/common/event-transformer.ts中
    // 可以自定义这两个函数 来修改事件属性，transformPointForCanvas中将坐标转换后存放了_canvasX _canvasY，mapToCanvasPointForCanvas中加以利用
    // 在VTable的touch文件中，利用到了_canvasX _canvasY 所以如果自定义上面两个函数也需提供_canvasX _canvasY
  };
  cancelTransform = (rotateDom: HTMLElement) => {
    this.rotateDegree = 0;
    rotateDom.style.transform = 'none';
    rotateDom.style.transformOrigin = 'none';
    const domRect = this._vchart.getContainer().getBoundingClientRect();
    const x1 = domRect.left;
    const y1 = domRect.top;
    const x2 = domRect.right;
    const y2 = domRect.bottom;

    const getRect = () => {
      return {
        x1,
        y1,
        x2,
        y2
      } as IAABBBounds;
    };
    const getMatrix = () => {
      const matrix = matrixAllocate.allocate(1, 0, 0, 1, 0, 0);
      matrix.translate(x1, y1);
      return matrix;
    };
    registerGlobalEventTransformer(vglobal, this._vchart.getContainer(), getMatrix, getRect, transformPointForCanvas);
    registerWindowEventTransformer(
      this._vchart.getStage().window,
      this._vchart.getContainer(),
      getMatrix,
      getRect,
      transformPointForCanvas
    );
    vglobal.mapToCanvasPoint = this.vglobal_mapToCanvasPoint;
  };

  release() {
    this._vchart = null;
    this.vglobal_mapToCanvasPoint = null;
    this.matrix = null;
    super.release();
  }
}

export const registerRotatePlugin = () => {
  registerVChartPlugin(RotatePlugin);
};
