export default {
  type: 'funnel',
  maxSize: '75%',
  minSize: '10%',
  isTransform: true,
  shape: 'rect',
  color: {
    type: 'ordinal',
    range: ['#00328E', '#0048AA', '#005FC5', '#2778E2', '#4E91FF', '#70ABFF', '#8FC7FF', '#AEE2FF']
  },
  funnel: {
    style: {
      cornerRadius: 4,
      stroke: 'white',
      lineWidth: 2
    },
    state: {
      hover: {
        stroke: '#4e83fd',
        lineWidth: 1
      }
    }
  },
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
  transform: {
    style: {
      stroke: 'white',
      lineWidth: 2
    },
    state: {
      hover: {
        stroke: '#4e83fd',
        lineWidth: 1
      }
    }
  },
  label: {
    visible: true,
    style: {
      lineHeight: 16,
      limit: Infinity,
      text: datum => [`${datum.name}`, `${datum.value}`]
    }
  },
  outerLabel: {
    visible: true,
    position: 'right',
    alignLabel: false,
    style: {
      text: datum => {
        return `${datum.percent * 100}%`;
      }
    },
    line: {
      style: {
        lineDash: [2, 2]
      }
    }
  },
  transformLabel: {
    visible: true,
    style: {
      fill: 'black'
    }
  },
  data: [
    {
      name: 'funnel',
      values: [
        {
          value: 100,
          name: '简历初筛',
          percent: 1
        },
        {
          value: 80,
          name: '简历评估',
          percent: 0.8
        },
        {
          value: 50,
          name: '评估通过',
          percent: 0.5
        },
        {
          value: 30,
          name: '面试',
          percent: 0.3
        },
        {
          value: 10,
          name: '终面通过',
          percent: 0.1
        }
      ]
    }
  ],
  categoryField: 'name',
  valueField: 'value'
};
