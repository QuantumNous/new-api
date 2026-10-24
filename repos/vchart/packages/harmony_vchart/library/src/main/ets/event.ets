export class HTMLClickEvent {
  type: string = 'click';

  constructor(harmonyClickEvent: ClickEvent) {

  }
}

export class TouchItem {
  clientX: number = 0;
  clientY: number = 0;
  pageX: number = 0;
  pageY: number = 0;
  x: number = 0;
  y: number = 0;

  constructor(obj: TouchObject) {
    this.pageX = obj.windowX;
    this.pageY = obj.windowY;
    this.clientX = obj.windowX;
    this.clientY = obj.windowY;
    this.x = obj.x;
    this.y = obj.y;
  }
}

export class HTMLTouchEvent {
  type: string = '';
  touches: TouchItem[] = [];
  changedTouches: TouchItem[] = [];
  target: Object | null = null;

  constructor(harmonyTouchEvent: TouchEvent) {
    if (harmonyTouchEvent.type === TouchType.Down) {
      this.type = 'touchstart';
    } else if (harmonyTouchEvent.type === TouchType.Up || harmonyTouchEvent.type === TouchType.Cancel) {
      this.type = 'touchend';
    } else if (harmonyTouchEvent.type === TouchType.Move) {
      this.type = 'touchmove';
    }
    this.touches = harmonyTouchEvent.touches.map(t => new TouchItem(t));
    this.changedTouches = harmonyTouchEvent.touches.map(t => new TouchItem(t));
  }
}

