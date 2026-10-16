// index.ts
// 获取应用实例
// @ts-nocheck
const app = getApp<IAppOption>();

Page({
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
  // 事件处理函数
  bindViewTap(e: any, a: any) {
    const name = e.currentTarget.id;
    wx.navigateTo({
      url: `../gallery/chart/index?name=${name}`
    });
  },
  onLoad() {}
});
