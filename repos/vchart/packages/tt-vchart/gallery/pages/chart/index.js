Page({
  data: {
    spec: null,
    canvasId: null,
    events: null,
    options: {
      tooltipRenderMode: "canvas"
    },
    styles: `
      height: 60vh;
      width: 100%
    `
  },

  onLoad(options) {
    this.chartType = options.type;
    const spec = require(`../../data/${this.chartType}`).default;
    this.setData({
      spec,
      canvasId: options.type
    });
  }
});
