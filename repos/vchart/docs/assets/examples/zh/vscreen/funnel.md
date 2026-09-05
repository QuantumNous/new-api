---
category: examples
group: vscreen
title: 漏斗图
keywords: funnelChart,composition,trend,triangle
cover: /vchart/preview/vscreen-funnel.png
option: vscreen
---

# 漏斗图

大屏场景下的漏斗图

## 关键配置

- `type: funnel` 指定图表类型为漏斗图
- `categoryField` 指定分类字段
- `valueField` 指定值字段

## 代码演示

```javascript livedemo
const spec = {
  // default size
  // width: 400,
  // height: 225,
  type: 'funnel',
  padding: {
    left: 6,
    right: 6,
    top: 6,
    bottom: 6
  },
  shape: 'rect',
  categoryField: 'xJtaxqDRf7xL',
  valueField: '8srrutjHBtbS',
  funnelOrient: 'top',
  maxSize: '68%',
  data: [
    {
      id: 'data',
      values: [
        {
          '8srrutjHBtbS': 60,
          xJtaxqDRf7xL: '河北',
          transfer: null,
          baseTransfer: 1
        },
        {
          '8srrutjHBtbS': 30,
          xJtaxqDRf7xL: '山西',
          transfer: 0.5,
          baseTransfer: 0.5
        },
        {
          '8srrutjHBtbS': 50,
          xJtaxqDRf7xL: '内蒙古',
          transfer: 1.6666666666666667,
          baseTransfer: 0.8333333333333334
        },
        {
          '8srrutjHBtbS': 10,
          xJtaxqDRf7xL: '辽宁',
          transfer: 0.2,
          baseTransfer: 0.16666666666666666
        },
        {
          '8srrutjHBtbS': 20,
          xJtaxqDRf7xL: '吉林',
          transfer: 2,
          baseTransfer: 0.3333333333333333
        }
      ],
      fields: {
        xJtaxqDRf7xL: {
          alias: 'Province'
        },
        '8srrutjHBtbS': {
          alias: 'Profit'
        }
      }
    }
  ],
  isTransform: true,
  transformLabel: {
    visible: true,
    style: {
      fontSize: 12,
      fill: 'rgba(255, 255, 255, 1)',
      fontFamily: 'D-DIN',
      fontWeight: 'normal'
    }
  },
  transform: {
    interactive: false,
    style: {
      fill: 'rgba(67,67,67,0.29)'
    }
  },
  seriesField: 'xJtaxqDRf7xL',
  color: {
    field: 'xJtaxqDRf7xL',
    type: 'ordinal',
    range: ['#006EFF', '#00E5E5', '#2E55EA', '#B8E7FE', '#00D689'],
    specified: {}
  },
  legends: [
    {
      type: 'discrete',
      visible: true,
      id: 'legend-discrete',
      orient: 'top',
      position: 'end',
      layoutType: 'normal',
      maxRow: 1,
      title: {
        textStyle: {
          fontSize: 12,
          fill: 'rgba(255,255,255,0.45)'
        }
      },
      layoutLevel: 70,
      item: {
        focus: true,
        focusIconStyle: {
          size: 14
        },
        maxWidth: 400,
        spaceRow: 0,
        spaceCol: 0,
        padding: 0,
        background: {
          visible: false,
          style: {
            fillOpacity: 0.001
          }
        },
        label: {
          style: {
            fontSize: 12,
            fill: 'rgba(255,255,255,0.45)',
            fontFamily: 'D-DIN',
            fontWeight: 'normal'
          },
          state: {
            unSelected: {
              fillOpacity: 0.2
            }
          }
        },
        shape: {
          style: {
            lineWidth: 0,
            symbolType: 'square',
            size: 12,
            fillOpacity: 1,
            width: 12,
            height: 7.416
          }
        }
      },
      pager: {
        layout: 'horizontal',
        padding: 0,
        textStyle: {},
        space: 0,
        handler: {
          preShape: 'triangleLeft',
          nextShape: 'triangleRight',
          style: {},
          state: {
            disable: {}
          }
        }
      },
      alignSelf: 'end',
      padding: {
        top: 0,
        bottom: 16,
        left: 0,
        right: 0
      }
    }
  ],
  label: {
    visible: true,
    offset: 3,
    overlap: {
      hideOnHit: true,
      avoidBaseMark: false,
      strategy: [
        {
          type: 'position',
          position: ['top', 'bottom']
        }
      ],
      clampForce: true
    },
    style: {
      fontSize: 10,
      fontFamily: 'D-DIN',
      fontWeight: 'normal',
      zIndex: 400,
      lineHeight: '100%',
      fill: 'rgba(255,255,255,1)',
      strokeOpacity: 0
    },
    smartInvert: false,
    fontWeight: 'normal'
  },
  outerLabel: {
    visible: false,
    style: {
      fontSize: 10,
      fill: 'rgba(255,255,255,1)'
    },
    line: {
      style: {
        stroke: '#9ca0b1'
      }
    }
  },
  hover: {
    enable: true
  },
  select: {
    enable: true
  },
  funnel: {
    state: {
      hover: {
        cursor: 'pointer',
        fillOpacity: 0.8,
        stroke: '#58595B',
        lineWidth: 1,
        zIndex: 500
      },
      selected: {
        cursor: 'pointer',
        fillOpacity: 1,
        stroke: '#58595B',
        lineWidth: 1
      },
      selected_reverse: {
        fillOpacity: 0.3,
        lineWidth: 0.3
      }
    },
    style: {
      lineWidth: 1
    }
  },
  tooltip: {
    visible: true,
    renderMode: 'canvas',
    mark: {
      visible: true,
      updateContent: (prev, datum, context) => {
        prev.forEach(p => {
          // p.shapeType = tooltipShape
          p.value = p.value + '.00';
        });
        return prev;
      }
    },
    style: {
      panel: {
        padding: {
          top: 5,
          bottom: 10,
          left: 10,
          right: 10
        },
        backgroundColor: 'rgba(8, 28, 48, 0.95)',
        border: {
          color: '#CFCFCF',
          width: 0,
          radius: 2
        },
        shadow: {
          x: 0,
          y: 4,
          blur: 12,
          spread: 0,
          color: 'rgba(0, 0, 0, 0.2)'
        }
      },
      titleLabel: {
        fontSize: 14,
        fontColor: '#FFF',
        fontWeight: 'bold',
        fontFamily: 'D-DIN',
        align: 'left',
        lineHeight: 18
      },
      keyLabel: {
        fontSize: 12,
        fontColor: 'rgba(255,255,255,0.65)',
        fontWeight: 'normal',
        fontFamily: 'SourceHanSansCN-Normal',
        align: 'left',
        lineHeight: 18
      },
      valueLabel: {
        fontSize: 12,
        fontColor: '#FFF',
        fontWeight: 'normal',
        fontFamily: 'D-DIN',
        align: 'right',
        lineHeight: 18
      },
      shape: {
        size: 10,
        spacing: 10
      },
      spaceRow: 10
    },
    dimension: {
      visible: true,
      updateContent: (prev, datum, context) => {
        prev.forEach(p => {
          // p.shapeType = tooltipShape
          p.value = p.value + '.00';
        });
        return prev;
      }
    }
  },
  region: [
    {
      clip: true
    }
  ],
  background: 'rgba(0, 0, 0, 1)',
  animation: false,
  crosshair: {
    xField: {
      line: {
        style: {
          fillOpacity: 1,
          fill: 'rgba(80,156,255,0.1)'
        }
      },
      visible: false
    },
    yField: {
      line: {
        style: {
          fillOpacity: 1,
          fill: 'rgba(80,156,255,0.1)'
        }
      },
      visible: false
    }
  },
  morph: {
    enable: false
  },
  axesPadding: true,
  plotLayout: {
    clip: false
  },
  hash: '675eb005c2307a0e2dbc44f3475c22d4'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[饼图](link)
