export default {
  type: 'pie',
  data: {
    values: [
      {
        value: 335,
        name: '直接访问'
      },
      {
        value: 310,
        name: '邮件营销'
      },
      {
        value: 274,
        name: '联盟广告'
      },
      {
        value: 235,
        name: '视频广告'
      },
      {
        value: 400,
        name: '搜索引擎'
      }
    ]
  },
  legends: {
    visible: true,
    orient: 'left'
  },
  type: 'pie',
  radius: 1,
  innerRadius: 0.6,
  valueField: 'value',
  categoryField: 'name',
  indicator: {
    visible: true,
    trigger: 'none',
    title: {
      visible: true,
      style: {
        fontSize: 16,
        fill: 'red',
        text: '总和'
      }
    },
    content: [
      {
        visible: true,
        style: {
          fontSize: 12,
          text: '1554'
        }
      }
    ]
  }
}
