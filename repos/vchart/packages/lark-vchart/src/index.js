import VChart from './vchart/index';
// import mapJson from "./data/map-data-china";

Component({
  properties: {
    styles: {
      type: String
    },
    canvasId: {
      type: String
    },
    spec: {
      type: Object,

      observer(newVal, oldVal) {
        if (this.chart && JSON.stringify(newVal) !== JSON.stringify(oldVal)) {
          // 更新 chart spec
          this.chart.updateSpec(newVal);
        }
      }
    },
    options: {
      type: Object,
      value: {}
    },
    events: {
      type: Object,
      value: []
    }
  },

  data: {
    offscreenCanvasWidth: 0,
    offscreenCanvasHeight: 0,
    chart: undefined
  },

  detached() {
    // 注销组件
    this.chart && this.chart.release();
  },

  ready() {
    if (!this.data.spec || !this.data.canvasId) {
      console.warn('组件需绑定 spec 变量并且设置唯一 canvas-id');
      return;
    }

    // VChart.registerMap("china", mapJson, {
    //   type: "geojson"
    // });

    tt.onWindowResize(res => {
      this.init();
    });

    // 初始化图表库
    this.init();
  },

  methods: {
    init() {
      tt.createSelectorQuery()
        .in(this)
        .select(`#${this.data.canvasId}_draw_canvas`)
        .boundingClientRect(domref => {
          if (!domref) {
            console.error(`未找到 #${this.data.canvasId} 组件`);
            return;
          }

          this.setData({
            offscreenCanvasWidth: domref.width,
            offscreenCanvasHeight: domref.height
          });

          // will call on WindowResize
          // release old chart first
          this.chart && this.chart.release();

          const chartInstance = new VChart(
            {
              ...this.data.spec,
              width: domref.width,
              height: domref.height
            },
            {
              mode: 'miniApp',
              modeParams: {
                domref,
                force: true,
                canvasIdLists: [
                  `${this.data.canvasId}_draw_canvas`,
                  `${this.data.canvasId}_tooltip_canvas`,
                  `${this.data.canvasId}_hit_canvas`
                ],
                tooltipCanvasId: `${this.data.canvasId}_tooltip_canvas`,
                freeCanvasIdx: 2
              },
              // Get the dpr live as it will change at runtime due to dragging to different monitors
              dpr: tt.getSystemInfoSync().pixelRatio,
              renderCanvas: `${this.data.canvasId}_draw_canvas`,
              ...this.data.options
            }
          );
          this.chart = chartInstance;
          this.triggerEvent('chartinit');

          if (this.data.events) {
            this.data.events.forEach(event => {
              event && chartInstance.on(event.type, { ...event.query, source: 'chart' }, event.handler);
            });
          }

          chartInstance.renderAsync().then(res => {
            this.triggerEvent('chartready');
          });
        })
        .exec();
    },

    bindEvent(event) {
      // 处理下 mouse 事件和 touch 事件，防止重复触发
      const { brand } = tt.getSystemInfoSync();
      if (brand === 'PC' && event.type.startsWith('touch')) {
        return;
      }
      if (brand !== 'PC' && event.type.startsWith('mouse')) {
        return;
      }
      const chartInstance = this.chart;
      if (chartInstance) {
        event.target = chartInstance.getCanvas(); // Tip: 必须设置
        chartInstance.getStage().window.dispatchEvent(event);
      }
    }
  }
});
