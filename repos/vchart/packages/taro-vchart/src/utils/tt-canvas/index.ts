import type { IEvent, IOptions, IVChart, IChartProps, IDomRef, IVChartConstructor } from '../../typings';
export interface IProps {
  chartConstructor: IVChartConstructor;
  dpr: number;
  domref: IDomRef;
  mode?: string;
  // size: { width: number; height: number };
  // canvasMap: any[];
  spec: object;
  events?: IEvent[];
  options?: IOptions;
  onChartInit?: any;
  onChartReady?: any;
  onChartUpdate?: any;
}

interface ITTCanvas {
  chartInstance: IVChart;
  init: () => IVChart;
  renderAsync: () => void;
  updateSpec: (props: IChartProps) => void;
  release: () => void;
}

export class TTCanvas implements ITTCanvas {
  private chartConstructor: IVChartConstructor;
  private dpr: number;
  private domref: IDomRef;
  private mode: string;
  private spec: object;
  private events?: IEvent[];
  private options?: IOptions;
  private onChartInit?: any;
  private onChartReady?: any;
  private onChartUpdate?: any;

  chartInstance: IVChart;

  constructor(props: IProps) {
    const {
      chartConstructor,

      dpr,
      events,
      spec,
      options,
      domref,
      mode,

      onChartInit,
      onChartReady,
      onChartUpdate
    } = props;

    this.chartConstructor = chartConstructor;
    this.domref = domref;
    this.mode = mode || 'miniApp';
    this.dpr = dpr;
    this.spec = spec;
    this.events = events;
    this.options = options;

    /**
     * 三个生命周期函数
     */
    this.onChartInit = onChartInit;
    this.onChartReady = onChartReady;
    this.onChartUpdate = onChartUpdate;

    /**
     * 图表初始化以及渲染
     */
    this.init();
    this.renderAsync();
  }

  init() {
    const domref = this.domref;
    this.chartInstance = new this.chartConstructor(
      // @ts-ignore
      {
        width: domref.width, // Tip: 跨端环境需要手动传入宽高
        height: domref.height,
        ...this.spec
      },
      {
        mode: this.mode, //  Tip: 跨端环境需要手动传入 mode
        // 跨端参数
        modeParams: {
          domref, // 图表绘制的 canvas 节点
          force: true, // 是否强制使用 canvas 绘制
          canvasIdLists: [`${domref.id}_draw_canvas`, `${domref.id}_tooltip_canvas`, `${domref.id}_hidden_canvas`], // canvasId 列表
          tooltipCanvasId: `${domref.id}_tooltip_canvas`, // tooltip canvasId
          freeCanvasIdx: 2 // 自由 canvas 索引
        },
        dpr: this.dpr, // Tip: 跨端环境需要手动传入 dpr
        renderCanvas: `${domref.id}_draw_canvas`, // 声明用于绘制的 canvasId
        ...this.options
      }
    ) as IVChart;

    this.onChartInit && this.onChartInit(this.chartInstance);

    // events
    if (this.events) {
      this.events.forEach(event => {
        this.chartInstance.on(event.type, { ...event.query, source: 'chart' }, event.handler);
      });
    }

    return this.chartInstance;
  }

  renderAsync() {
    this.chartInstance?.renderAsync().then((chart: IVChart) => {
      this.onChartReady && this.onChartReady(chart);
      return chart;
    });
  }

  updateSpec(props: IChartProps) {
    this.onChartUpdate && this.onChartUpdate(this.chartInstance);
    this.chartInstance?.updateSpec(props.spec, true);
  }

  release() {
    if (!this.chartInstance) return;
    // 释放: 图表
    this.chartInstance.release();
  }
}
