export default {
  type: "line",
  data: [
    {
      name: "line",
      fields: {
        y: {
          alias: "基金涨跌",
        },
      },
      values: [
        {
          x: "1号",
          y: 0.012,
        },
        {
          x: "2号",
          y: -0.01,
        },
        {
          x: "3号",
          y: 0.005,
        },
        {
          x: "4号",
          y: 0.007,
        },
        {
          x: "5号",
          y: 0.01,
        },
        {
          x: "6号",
          y: 0.017,
        },
        {
          x: "7号",
          y: 0.022,
        },
        {
          x: "8号预测",
          y: 0.033,
          latest: true,
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
  label: {
    visible: false,
    format: {
      name: "formatNumber",
      type: "percent",
    },
  },
  xField: "x",
  yField: "y",
  line: {
    style: {
      lineDash: {
        type: "ordinal",
        field: "latest",
        range: [
          [1, 0],
          [4, 4],
        ],
      },
      stroke: {
        scale: "color",
        field: "latest",
      },
    },
  },
  point: {
    style: {
      fill: {
        scale: "color",
        field: "latest",
      },
    },
    state: {
      dimension_hover: {
        scaleX: 1.5,
        scaleY: 1.5,
      }
    }
  },
  color: {
    type: "ordinal",
    field: "latest",
    range: ["#ccc", "#468DFF"],
  },
};
