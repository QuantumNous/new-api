import type { IZoomTrigger } from './interface';

export class DeskTopTrigger implements IZoomTrigger {
  parserScrollEvent(e: any) {
    if (!e) {
      return e;
    }

    // 经过测试ctrlKey这个字段只有在双指方向不一致时，才会为true，根据这个判断是否触发scroll事件
    if (!e.ctrlKey && (e.deltaY !== 0 || e.deltaX !== 0)) {
      e.scrollX = e.deltaX;
      e.scrollY = e.deltaY;
      return e;
    }

    return false;
  }

  parserZoomEvent(e: any) {
    if (!e) {
      return e;
    }
    // @see https://vega.github.io/vega/examples/zoomable-world-map/
    const zoom = Math.pow(1.0005, -e.deltaY * Math.pow(16, e.deltaMode));
    e.zoomDelta = zoom;
    e.zoomX = e.canvasX;
    e.zoomY = e.canvasY;
    return e;
  }
  clearZoom(): void {
    // do nothing
  }

  clearScroll(): void {
    // do nothing
  }

  clearDrag(): void {
    // do nothing
  }
}
