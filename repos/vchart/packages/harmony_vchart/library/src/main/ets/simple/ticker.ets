import animator, { AnimatorOptions, AnimatorResult } from '@ohos.animator';
import { DefaultTicker } from '../index-harmony-simple.es.min.js';
import hilog from '@ohos.hilog';

class Target {
  render() {};
}
class Stage {
  render() {};
}
type IAnimate = Object;

export interface ITimeline {
  id: number;
  animateCount: number;
  addAnimate: (animate: IAnimate) => void;
  removeAnimate: (animate: IAnimate, release?: boolean) => void;
  animateHead: IAnimate | null;
  tick: (delta: number) => void;
  clear: () => void;
  pause: () => void;
  resume: () => void;
}

enum STATUS {
  INITIAL = 0, // initial表示初始状态
  RUNNING = 1, // running表示正在执行
  PAUSE = 2 // PULSE表示tick还是继续，只是不执行函数了
}

interface ITickParams { once?: boolean }

class HarmonyTickHandler {
  protected released: boolean = false;
  animatorResult: AnimatorResult;
  protected nextCb: ((handler: HarmonyTickHandler) => void) | null = null;
  timerId: number = 0;
  declare stage?: Stage;
  stamp: number = 0;

  static Avaliable(): boolean {
    return true;
  }
  avaliable(): boolean {
    return HarmonyTickHandler.Avaliable();
  }

  constructor() {
    let options: AnimatorOptions = {
      duration: 1000000,
      easing: 'linear',
      delay: 0,
      fill: "forwards",
      direction: "normal",
      iterations: 1,
      begin: 0,
      end: 1
    };
    this.animatorResult = animator.create(options);
    this.animatorResult.onframe = value => {
      console.log('========== 动画', this.nextCb)
      const stamp = this.stamp;
      if (this.nextCb) {
        this.nextCb(this);
        this.stage && this.stage.render();
      }
      // 如果期间没有再调用nextCb，就删掉
      if (this.stamp === stamp) {
        this.nextCb = null;
      }
    }
    this.animatorResult.play();
  }

  tick(interval: number, cb: (handler: HarmonyTickHandler) => void): void {
    this.nextCb = cb;
    this.stamp++;
  }

  release() {
    this.released = true;
    this.animatorResult.cancel();
  }
  getTime() {
    return Date.now();
  }
}
export class HarmonyTicker extends DefaultTicker {
  stage?: Stage;
  declare _mode: string;
  declare tickerHandler: HarmonyTickHandler;
  set mode(m: string) {
    if (this._mode === m) {
      return;
    }
    this._mode = m;
    this.setupTickHandler();
  }
  get mode(): string {
    return this._mode;
  }

  constructor(timelines: ITimeline[] = []) {
    super(timelines);
  }

  // declare tickerHandler: HarmonyTickHandler;
  initHandler(): null {
    if (this._mode) {
      return null;
    }
    this.mode = 'harmony';
    return null;
  }

  start(force: boolean = false): boolean {
    return super.start(force);
  }

  setupTickHandler(): boolean {
    this.tickerHandler = new HarmonyTickHandler();
    return true;
  }

  bindStage(stage: Stage) {
    this.stage = stage;
    this.tickerHandler.stage = stage;
  }
}
