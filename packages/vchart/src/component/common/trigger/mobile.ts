import type { IZoomTrigger } from './interface';
export class MobileTrigger implements IZoomTrigger {
  private _lastScale = 0;

  clearZoom(): void {
    this._lastScale = 0;
  }

  // parserDragEvent(event: any): boolean {
  //   // 下面的代码逻辑本意是：单指(pointerId===0) -> 多指(pointerId === 1) 切换后, 终止touch事件
  //   // 问题：ios系统/部分MIUI系统，单指/多指滑动过程中, pointerId每次都不一样，所以无法做到上述识别
  //   // 解决方法: 暂时不做流程判断, 如果后续有需求, 单指 -> 多指可以考虑用event.isPrimary判断
  //   // if (this.pointerId) {
  //   //   return this.pointerId === event.pointerId;
  //   // }
  //   // this.pointerId = event.pointerId;
  //   return true;
  // }

  parserZoomEvent(event: any) {
    const scale = event.scale;
    if (this._lastScale === 0) {
      this._lastScale = scale;
      return event;
    }
    event.zoomDelta = scale / this._lastScale;

    const center = event.center;
    event.zoomX = center.x;
    event.zoomY = center.y;
    this._lastScale = scale;

    return event;
  }

  parserScrollEvent(event: any) {
    // todo
    return event;
  }

  clearScroll(): void {
    // do nothing
  }

  clearDrag(): void {
    // do nothing
  }
}
