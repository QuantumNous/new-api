import { HTMLTouchEvent } from './event';
import { HarmonyTicker } from './ticker';
import { VChart as VChartConstructor, vglobal } from './index-harmony.es.min.js';

vglobal.setEnv('harmony');

interface IWH {
  width: number;
  height: number;
}

class RenderCanvas {
  width: number;
  height: number;
  context: CanvasRenderingContext2D;
  constructor(w: number, h: number, context: CanvasRenderingContext2D) {
    this.width = w;
    this.height = h;
    this.context = context;
  }
  getBoundingClientRect(): IWH {
    return {
      width: this.width,
      height: this.height
    };
  }
  getContext(p: string): CanvasRenderingContext2D {
    return this.context;
  }
}

interface IGraphic {
  setAttributes(params: Record<string, string|number>): void;
}

export interface IInitOption {
  /**
   * 图表开始渲染的回调
   * @param vchart
   */
  beforeRender?: (stage: Object) => void;
  /**
   * 渲染完成的回调
   * @param vchart
   */
  afterRender?: (stage: Object) => void;
  /**
   * 启用的插件列表
   */
  pluginList?: string[];
  /** 数据集 */
  dataSet?: Object;
  /**
   * 是否开启动画
   */
  animation?: boolean;
  /**
   * 当文本省略时，鼠标 hover 到文本上时是否显示 poptip
   * @default true
   */
  poptip?: boolean;

  /**
   * 报错的回调函数
   * @since 1.2.0
   */
  onError?: () => void;

  /**
   * 默认主题（支持完整主题对象或者主题名称，主题名称需要提前在 `ThemeManager` 中注册）
   * @since 1.3.0
   */
  theme?: string;
}

@Component
export struct VChart {
  private settings: RenderingContextSettings = new RenderingContextSettings(true) // 开启抗锯齿
  private context: CanvasRenderingContext2D = new CanvasRenderingContext2D(this.settings)
  private w: number = 300;
  private h: number = 300;
  @Link @Watch('onSpecUpdate') private spec: Object | null;
  private vchart: VChartConstructor | null = null;
  @State time: string = '';

  private fullScreen: boolean = true;
  private initOption: IInitOption = {};

  /**
   * 图表初始化的回调
   * @param vchart
   */
  onChartInitCb?: (vchart: VChartConstructor) => void;
  /**
   * 图表准备好的回调
   * @param vchart
   */
  onChartReadyCb?: (vchart: VChartConstructor) => void;


  onSpecUpdate(propName: string) {
    if (!this.vchart) {
      return;
    }
    const spec = this.spec as Record<string, string | number>
    spec.height = this.h;
    spec.width = this.w;
    this.processDefaultTooltipShadow();
    this.vchart.updateSpecSync(this.spec);
  }

  bindChartTouchEvent = (event: TouchEvent) => {
    if (!this.vchart) {
      return;
    }
    const stage: number = this.vchart.getStage();
    console.log(vglobal, stage);
    const e = new HTMLTouchEvent(event);
    e.target = this.vchart.getCanvas();
    this.vchart.getStage().window.dispatchEvent(e);
  }

  // harmony的shadowColor不支持透明度，导致tooltip的shadow过深，这里做一下兼容（如果用户配置了shadow就不处理）
  processDefaultTooltipShadow() {

  }

  aboutToDisappear(): void {
    this.vchart && this.vchart.release();
  }

  build() {
    Column() {
      Canvas(this.context)
        .width(this.w)
        .height(this.h)
        .onReady(() => {
          if (!this.spec) {
            return;
          }
          let date = Date.now();
          const spec = this.spec as Record<string, string | number>
          spec.width = this.w;
          spec.height = this.h;
          // 必须用类的形式
          const renderCanvas = new RenderCanvas(this.w, this.h, this.context);
          const ticker = new HarmonyTicker();
          this.vchart = new VChartConstructor(this.spec, {
            renderCanvas,
            mode: 'harmony',
            dpr: 1,
            ticker: ticker,
            autoRender: true,
            disableDirtyBounds: this.fullScreen,
            beforeRender: this.initOption.beforeRender,
            afterRender: this.initOption.afterRender,
            pluginList: this.initOption.pluginList,
            dataSet: this.initOption.dataSet,
            animation: this.initOption.animation,
            poptip: this.initOption.poptip,
            theme: this.initOption.theme,
            onError: this.initOption.onError
          });
          ticker.bindStage(this.vchart.getStage());
          this.onChartInitCb && this.onChartInitCb(this.vchart);
          this.vchart.renderSync();
          this.onChartReadyCb && this.onChartReadyCb(this.vchart);

          // let options: AnimatorOptions = {
          //   duration: 600000,
          //   easing: 'linear',
          //   delay: 0,
          //   fill: "forwards",
          //   direction: "normal",
          //   iterations: 1,
          //   begin: 0,
          //   end: 1
          // };
          // let animatorResult = animator.create(options);
          // let x = 100;
          // let y = 100;
          // const animate = () => {
          //   // this.context.clearRect(0, 0, 1000, 1000);
          //   x++;
          //   if (x > 300) {
          //     x = 0;
          //     y += 10;
          //   }
          //   this.context.fillStyle = 'red';
          //   this.context.fillRect(x, y, 30, 30);
          //   animatorResult.play();
          // }
          // animatorResult.onframe = (value) => {
          //   hilog.info(0, "测试", 'aaaaaa');
          //   animate();
          // }
          // animatorResult.play();
        })
        .onTouch(this.bindChartTouchEvent);
        Text(this.time)
    }
  }
}
