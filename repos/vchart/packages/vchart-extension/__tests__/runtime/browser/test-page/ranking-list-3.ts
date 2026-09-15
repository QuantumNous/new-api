import { registerRankingList } from '../../../../src';
import { VChart } from '@visactor/vchart';
import { GUI } from 'lil-gui';

const guiObject = {
  name: 'rankingList',
  labelLayout: 'bothEnd',
  pageSize: 8,
  scrollSize: 2,
  animationType: 'both',
  animationInterval: 4000,
  animationDuration: 2000,
  animationEasing: 'linear',
  rankingIconVisible: true,
  orderLabelVisible: true
};

const chartData = [
  {
    y: '南宁',
    x: 38
  },
  {
    y: '百色',
    x: 37
  },
  {
    y: '桂林',
    x: 36
  },
  {
    y: '柳州',
    x: 35
  },
  {
    y: '钦州',
    x: 34
  },
  {
    y: '玉林',
    x: 33
  },
  {
    y: '贵港',
    x: 32
  },
  {
    y: '河池',
    x: 31
  },
  {
    y: '崇左',
    x: 30
  },
  {
    y: '防城港',
    x: 29
  }
];
console.log(chartData);

const spec = {
  type: 'rankingList',
  data: chartData,
  xField: 'x',
  yField: 'y',
  // background: 'rgba(0,0,0,1)',
  width: 400,
  height: 900,
  padding: {
    right: 10,
    left: 80
  },
  bar: {
    height: 20,
    visible: false,
    style: {
      visible: false,
      cornerRadius: 10
    }
  },
  barBackground: {
    type: 'rect',
    style: {
      // fill: 'rgba(245,46,0,1)',
      cornerRadius: [0, 10, 10, 0],
      fill: datum => {
        if (['南宁', '百色', '桂林'].includes(datum['y'])) {
          return 'rgba(245,46,0,1)';
        } else if (['柳州', '钦州', '玉林', '贵港', '河池'].includes(datum['y'])) {
          return 'rgba(255,95,0,1)';
        } else {
          return 'rgba(255,135,0,1)';
        }
      }
    }
  },
  labelLayout: guiObject.labelLayout,

  rankingIcon: {
    visible: true,
    style: {
      symbolType: 'circle',
      x: 0,
      size: 50,
      dx: -20,
      fill: datum => {
        if (['南宁', '百色', '桂林'].includes(datum['y'])) {
          return 'rgba(245,46,0,1)';
        } else if (['柳州', '钦州', '玉林', '贵港', '河池'].includes(datum['y'])) {
          return 'rgba(255,95,0,1)';
        } else {
          return 'rgba(255,135,0,1)';
        }
      }
    }
  },
  orderLabel: {
    visible: true,
    style: {
      fontSize: 25,
      fill: 'rgba(180, 70, 0, 1)'
    }
  },
  nameLabel: {
    visible: true,
    zIndex: 999,
    style: {
      fontSize: 15,
      fill: '#fff',
      dx: 4,
      zIndex: 999
    }
  },
  valueLabel: {
    visible: true,
    style: {
      fontSize: 25,
      fill: 'rgba(180, 70, 0, 1)',
      dx: -70,
      dy: -25
    }
  },
  decorateHaloIcons: [
    // {
    //   visible: true,
    //   zIndex: -10,
    //   style: {
    //     symbolType: 'circle',
    //     fill: 'rgba(245,46,0,1)',
    //     x: 0,
    //     size: 50,
    //     dx: -20
    //   }
    // }
  ],
  pageSize: guiObject.pageSize,
  scrollSize: guiObject.scrollSize,
  animation: false,
  background: {
    gradient: 'linear',
    x0: 0,
    y0: 0,
    x1: 0,
    y1: 1,
    stops: [
      {
        offset: 0,
        color: 'rgba(255,132,0,1)'
      },
      {
        offset: 1,
        color: 'rgba(255,244,166,1)'
      }
    ]
  },
  title: [
    {
      text: '广西整点气温排行',
      align: 'center',
      textStyle: {
        fill: 'rgba(128, 20, 2, 1)',
        fontSize: 35,
        stroke: '#fff',
        lineWidth: 1,
        fontFamily: 'SimSun, Songti SC',
        dx: -20
      }
    },
    {
      text: '7月28日08时',
      align: 'center',
      padding: 5,
      textStyle: {
        fill: '#fff',
        fontSize: 10,
        fontWeight: 'normal',
        dx: -20
      }
    },
    {
      text: '单位: °C',
      align: 'right',
      padding: 5,
      textStyle: {
        fill: '#fff',
        fontSize: 10,
        fontWeight: 'normal',
        dx: -20
      }
    },
    {
      text: '注:数据基于国家级气象站实况气温,来源广西壮族自治区气象台',
      orient: 'bottom',
      align: 'center',
      textStyle: {
        fill: 'rgba(100, 100, 100, 1)',
        fontSize: 10,
        fontWeight: 'normal'
      }
    }
  ],
  markLine: chartData.map(datum => {
    return {
      y: datum['y'],
      x: 26,
      x1: 'max',
      line: {
        style: {
          stroke: '#fff',
          lineWidth: 2,
          lineDash: [5, 5]
        }
      },
      endSymbol: {
        style: {
          fill: '#fff'
        }
      }
    };
  })
};

const run = () => {
  registerRankingList();
  const cs = new VChart(spec, {
    dom: document.getElementById('chart') as HTMLElement,
    //theme: 'dark',
    onError: err => {
      console.error(err);
    }
  });
  console.time('renderTime');

  cs.renderSync();

  // gui
  const gui = new GUI();
  gui.add(guiObject, 'name');
  gui.add(guiObject, 'labelLayout', ['top', 'bothEnd']).onChange(value => {
    cs.updateSpec(
      {
        ...spec,
        labelLayout: value
      },
      false,
      {
        enableExitAnimation: false
      }
    );
  });
  gui.add(guiObject, 'pageSize').onChange(value => {
    cs.updateSpec(
      {
        ...spec,
        pageSize: value
      },
      false,
      {
        enableExitAnimation: false
      }
    );
  });
  gui.add(guiObject, 'scrollSize').onChange(value => {
    cs.updateSpec(
      {
        ...spec,
        scrollSize: value
      },
      false,
      {
        enableExitAnimation: false
      }
    );
  });
  gui.add(guiObject, 'animationType', ['both', 'scroll', 'grow']).onChange(value => {
    cs.updateSpec(
      {
        ...spec,
        animation: {
          ...spec.animation,
          type: value
        }
      },
      false,
      {
        enableExitAnimation: false
      }
    );
  });
  gui.add(guiObject, 'animationInterval').onChange(value => {
    cs.updateSpec(
      {
        ...spec,
        animation: {
          ...spec.animation,
          interval: value
        }
      },
      false,
      {
        enableExitAnimation: false
      }
    );
  });

  gui.add(guiObject, 'animationDuration').onChange(value => {
    cs.updateSpec(
      {
        ...spec,
        animation: {
          ...spec.animation,
          duration: value
        }
      },
      false,
      {
        enableExitAnimation: false
      }
    );
  });

  gui.add(guiObject, 'animationEasing', ['linear', 'quadIn', 'quadOut', 'quadInOut']).onChange(value => {
    cs.updateSpec(
      {
        ...spec,
        animation: {
          ...spec.animation,
          easing: value
        }
      },
      false,
      {
        enableExitAnimation: false
      }
    );
  });
  gui.add(guiObject, 'rankingIconVisible').onChange(value => {
    cs.updateSpec(
      {
        ...spec,
        rankingIcon: {
          ...spec.rankingIcon,
          visible: value
        }
      },
      false,
      {
        enableExitAnimation: false
      }
    );
  });
  gui.add(guiObject, 'orderLabelVisible').onChange(value => {
    cs.updateSpec(
      {
        ...spec,
        orderLabel: {
          ...spec.orderLabel,
          visible: value
        }
      },
      false,
      {
        enableExitAnimation: false
      }
    );
  });

  console.timeEnd('renderTime');
  window['vchart'] = cs;
  console.log(cs);
};
run();
