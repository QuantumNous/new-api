// @ts-nocheck
Page({
  data: {
    spec: {},
    events: [],
    options: {}
  },
  chartType: '',
  stage: undefined,
  onLoad(options) {
    this.chartType = options.name || '';
    const spec = require(`../data/${this.chartType}`).default;
    this.setData({
      // 设置数据
      spec
    });
  },
  onChartInit(event: any) {
    console.log('chart 实例初始化完成', event);
  },

  onChartReady(event: any) {
    console.log('chart 实例渲染完成', event);
  }
});
