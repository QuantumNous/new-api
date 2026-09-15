Page({
  data: {
    spec: {},
    events: [],
    options: {}
  },

  onLoad(options) {
    this.chartType = options.type;
    const spec = require(`../../data/${this.chartType}`).default;
    this.setData({
      // 设置数据
      spec
    });
  },

  onChartInit(event) {
    console.log("chart 实例初始化完成", event);
  },

  onChartReady(event) {
    console.log("chart 实例渲染完成", event);

    // 饼图更新 spec，以支持自定义函数回调配置
    this.selectComponent("#pie", res => {
      const chartInstance = res && res.chart; // 获取 chart 实例
      if (chartInstance) {
        const newSpec = {
          type: 'pie',
          data: [
            {
              id: 'id0',
              values: [
                { type: 'oxygen', value: '46.60' },
                { type: 'silicon', value: '27.72' },
                { type: 'aluminum', value: '8.13' },
                { type: 'iron', value: '5' },
                { type: 'calcium', value: '3.63' },
                { type: 'sodium', value: '2.83' },
                { type: 'potassium', value: '2.59' },
                { type: 'others', value: '3.5' }
              ]
            }
          ],
          outerRadius: 0.8,
          valueField: 'value',
          categoryField: 'type',
          title: {
            visible: true,
            text: '地表元素含量统计'
          },
          legends: {
            visible: false
          },
          label: {
            visible: true,
            formatMethod: (text, datum) => {
              return `${text}: ${datum.value}`
            }
          },
          pie: {
            state: {
              hover: {
                radiusOffset: 10
              }
            }
          }
        };
        chartInstance.updateSpec(newSpec)
      }
    });
  }
});
