export default {
  type: 'radar',
  data: [
    {
      values: [
        {
          month: '1月',
          value: 45,
          type: 'A'
        },
        {
          month: '2月',
          value: 61,
          type: 'A'
        },
        {
          month: '3月',
          value: 92,
          type: 'A'
        },
        {
          month: '4月',
          value: 57,
          type: 'A'
        },
        {
          month: '5月',
          value: 46,
          type: 'A'
        },
        {
          month: '6月',
          value: 36,
          type: 'A'
        },
        {
          month: '7月',
          value: 33,
          type: 'A'
        },
        {
          month: '8月',
          value: 63,
          type: 'A'
        },
        {
          month: '9月',
          value: 57,
          type: 'A'
        },
        {
          month: '10月',
          value: 53,
          type: 'A'
        },
        {
          month: '11月',
          value: 69,
          type: 'A'
        },
        {
          month: '12月',
          value: 40,
          type: 'A'
        },
        {
          month: '1月',
          value: 31,
          type: 'B'
        },
        {
          month: '2月',
          value: 39,
          type: 'B'
        },
        {
          month: '3月',
          value: 81,
          type: 'B'
        },
        {
          month: '4月',
          value: 39,
          type: 'B'
        },
        {
          month: '5月',
          value: 64,
          type: 'B'
        },
        {
          month: '6月',
          value: 21,
          type: 'B'
        },
        {
          month: '7月',
          value: 58,
          type: 'B'
        },
        {
          month: '8月',
          value: 72,
          type: 'B'
        },
        {
          month: '9月',
          value: 47,
          type: 'B'
        },
        {
          month: '10月',
          value: 37,
          type: 'B'
        },
        {
          month: '11月',
          value: 80,
          type: 'B'
        },
        {
          month: '12月',
          value: 74,
          type: 'B'
        },
        {
          month: '1月',
          value: 90,
          type: 'C'
        },
        {
          month: '2月',
          value: 95,
          type: 'C'
        },
        {
          month: '3月',
          value: 62,
          type: 'C'
        },
        {
          month: '4月',
          value: 52,
          type: 'C'
        },
        {
          month: '5月',
          value: 74,
          type: 'C'
        },
        {
          month: '6月',
          value: 87,
          type: 'C'
        },
        {
          month: '7月',
          value: 80,
          type: 'C'
        },
        {
          month: '8月',
          value: 69,
          type: 'C'
        },
        {
          month: '9月',
          value: 74,
          type: 'C'
        },
        {
          month: '10月',
          value: 84,
          type: 'C'
        },
        {
          month: '11月',
          value: 94,
          type: 'C'
        },
        {
          month: '12月',
          value: 23,
          type: 'C'
        }
      ]
    }
  ],
  tooltip: {
    style: {
      panel: {
        shadow: {
          blur: 20,
          offsetX: 4,
          color: '#ff9b9b9b'
        }
      }
    }
  },
  categoryField: 'month',
  valueField: 'value',
  seriesField: 'type', // 声明分组字段
  stack: true,
  percent: true,
  area: {
    visible: true // 展示面积
  },
  axes: [
    {
      orient: 'radius', // 半径轴配置
      min: 0,
      domainLine: {
        visible: true
      },
      label: {
        visible: true,
        formatMethod: val => {
          return val * 100 + '%'
        }
      },
      grid: {
        smooth: false,
        style: {
          lineDash: [0]
        }
      }
    },
    {
      orient: 'angle', // 角度轴配置
      tick: {
        visible: false
      },
      domainLine: {
        visible: false
      },
      grid: {
        style: {
          lineDash: [0]
        }
      }
    }
  ],
  legends: {
    visible: true,
    orient: 'top'
  },
  crosshair: {
    categoryField: {
      label: {
        visible: true
      }
    }
  }
}
