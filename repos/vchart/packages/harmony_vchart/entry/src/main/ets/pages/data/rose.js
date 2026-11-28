export default {
  data: [
    {
      name: "data",
      values: [
        {
          value: 535,
          name: "社会",
        },
        {
          value: 410,
          name: "军事",
        },
        {
          value: 374,
          name: "历史",
        },
        {
          value: 335,
          name: "时政",
        },
        {
          value: 300,
          name: "美食",
        },
        {
          value: 295,
          name: "两性",
        },
        {
          value: 281,
          name: "健康",
        },
        {
          value: 270,
          name: "传媒",
        },
        {
          value: 263,
          name: "国际",
        },
        {
          value: 140,
          name: "娱乐",
        },
      ],
    },
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
  type: "rose",
  radius: 0.7,
  categoryField: "name",
  valueField: "value",
  seriesField: 'name',
  color: {
    type: "ordinal",
    range: [
      "#E9F2FF",
      "#D4E5FF",
      "#BED9FF",
      "#A8CCFF",
      "#93BFFF",
      "#7DB2FF",
      "#67A5FF",
      "#5199FF",
      "#3C8CFF",
      "#267FFF",
    ],
  },
  axes: [
    {
      orient: 'angle',
      domainLine: { visible: false },
      grid: { style: { lineDash: [0], stroke: '#F4F4F4' } },
      tick: {
        visible: false,
      },
      label: {
        space: 20,
        style: {
          fill: "rgba(22, 24, 35, 0.5)",
        }
      }
    },
    {
      orient: 'radius',
      domainLine: { visible: false },
      tick: {
        visible: false,
        tickCount: 3,
      },
      label: {
        visible: false
      },
      grid: { visible: true, smooth: true, style: { lineDash: [0], stroke: '#F4F4F4' } }
    }
  ],
  rose: {
    state: {
      hover: {
        lineWidth: 1,
        stroke: '#000'
      }
    }
  }
};
