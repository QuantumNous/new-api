const app = getApp();

Page({
  onShareAppMessage() {
    return {
      title: 'VChart 字节小程序示例',
      path: '/pages/index/index',
      success() {},
      fail() {}
    };
  },
  data: {
    charts: [
      {
        id: 'scatter',
        name: 'scatter'
      },
      {
        id: 'line',
        name: 'line'
      },
      {
        id: 'area',
        name: 'area'
      },
      {
        id: 'funnel',
        name: 'funnel'
      },
      {
        id: 'bar',
        name: 'bar'
      },
      {
        id: 'horizontal-bar',
        name: 'horizontal-bar'
      },
      {
        id: 'radar',
        name: 'radar'
      },
      {
        id: 'sankey',
        name: 'sankey'
      },
      {
        id: 'pie',
        name: 'pie'
      },
      {
        id: 'ring',
        name: 'ring'
      },
      {
        id: 'rose',
        name: 'rose'
      },
      {
        id: 'wordcloud',
        name: 'wordcloud'
      },
      {
        id: 'boxplot',
        name: 'boxplot'
      },
      {
        id: 'dual-axis',
        name: 'dual-axis'
      }
    ]
  },

  open(e) {
    tt.navigateTo({
      url: `../chart/index?type=${e.target.dataset.chart.id}`
    });
  }
});
