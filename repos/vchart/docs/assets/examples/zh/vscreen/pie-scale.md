---
category: examples
group: vscreen
title: 带改变尺寸动画的饼图
keywords: pieChart,comparison,composition,proportion,circle,animation
cover: /vchart/preview/pie-scale.gif
option: vscreen
---

# 带改变尺寸动画的饼图

动画执行过程:

1. 入场动画: 初次渲染时执行

- 径向: 扇区图元按角度展开
- 缩放: 扇区图元整体缩放

2. 常态动画: 每隔 interval 时长轮播执行动画

- 改变尺寸: 扇区图元依次放大尺寸
- 改变中心位置: 扇区图元依次以圆心为中心向外偏移

此案例包含:
入场: 径向 + 常态: 改变尺寸

## 关键配置

- `animationAppear`: 入场动画, 初次渲染时的动画效果
- `animationNormal`: 常态动画, 初次渲染后, 图表在没有任何状态更新情况下的动画效果, 通常以固定的间隔轮播执行
- `animationUpdate`: 图表更新状态时, 图元在更新时的动画效果
- `animationEnter`: 图表更新状态时, 图元在新增时的动画效果
- `animationExit`: 图表更新状态时, 图元在退场时的动画效果

## 代码演示

```javascript livedemo
const spec = {
  // default size
  // width: 400,
  // height: 225,
  // data mapping
  type: 'pie',
  categoryField: 'NYYSFm4bppn6',
  valueField: 'WCJbDjWgKp7o',
  seriesField: 'NYYSFm4bppn6',
  // animation
  animation: true,
  animationAppear: {
    pie: {
      type: 'growAngleIn',
      easing: 'linear',
      duration: 1000
    }
  },
  animationNormal: {
    pie: [
      {
        channel: {
          outerRadius: {
            from: (...p) => {
              return p[1].attribute.outerRadius;
            },
            to: (...p) => {
              return p[1].attribute.outerRadius + 10;
            }
          }
        },
        startTime: 5000,
        oneByOne: 1000,
        duration: 500,
        loop: true,
        easing: 'linear',
        delayAfter: 5500,
        controlOptions: {
          immediatelyApply: false
        }
      },
      {
        channel: {
          outerRadius: {
            from: (...p) => {
              return p[1].attribute.outerRadius + 10;
            },
            to: (...p) => {
              return p[1].attribute.outerRadius;
            }
          }
        },
        startTime: 5000,
        oneByOne: 1000,
        duration: 500,
        easing: 'linear',
        delay: 500,
        delayAfter: 5000,
        loop: true,
        controlOptions: {
          immediatelyApply: false
        }
      }
    ]
  },
  // chart style
  outerRadius: 0.75,
  radius: 0.75,
  innerRadius: 0.6975,
  padAngle: 2,
  cornerRadius: 0,
  // mark style
  pie: {
    state: {
      hover: {
        cursor: 'pointer',
        fillOpacity: 0.8,
        stroke: '#58595B',
        lineWidth: 1,
        zIndex: 500,
        outerRadius: 0.8
      },
      selected: {
        cursor: 'pointer',
        fillOpacity: 1,
        stroke: '#58595B',
        lineWidth: 1,
        outerRadius: 0.8
      },
      selected_reverse: {
        fillOpacity: 0.3,
        lineWidth: 0.3
      }
    }
  },
  // global style
  padding: {
    left: 6,
    right: 6,
    top: 6,
    bottom: 6
  },
  background: 'rgba(0, 0, 0, 1)',
  // color mapping
  color: {
    field: 'NYYSFm4bppn6',
    type: 'ordinal',
    range: ['#006EFF', '#00E5E5', '#2E55EA', '#B8E7FE', '#00D689'],
    specified: {},
    domain: ['河北', '山西', '内蒙古', '辽宁', '吉林']
  },
  // componnet style
  legends: [
    {
      type: 'discrete',
      visible: true,
      id: 'legend-discrete',
      orient: 'bottom',
      position: 'start',
      layoutType: 'normal',
      maxRow: 1,
      title: {
        textStyle: {
          fontSize: 12,
          fill: 'rgba(255,255,255,1)'
        }
      },
      layoutLevel: 30,
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
            fill: 'rgba(255,255,255,1)',
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
            symbolType: 'circle',
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
      alignSelf: 'start',
      padding: {
        top: 16,
        bottom: 0,
        left: 0,
        right: 0
      }
    }
  ],

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
  // decorate mark
  extensionMark: [
    {
      name: 'arc_inner_shadow',
      type: 'arc',
      dataId: 'data',
      style: {
        padAngle: (Math.PI / 180) * 2,
        interactive: false,
        startAngle: (...params) => {
          return params[0]['__VCHART_ARC_START_ANGLE'];
        },
        endAngle: (...params) => {
          return params[0]['__VCHART_ARC_END_ANGLE'];
        },
        innerRadius: (...params) => {
          return params[1].getLayoutRadius() * 0.6975 - 10;
        },
        outerRadius: (...params) => {
          // console.log('params-shadow', params[1].getLayoutRadius(), params[1].getCenter())
          return params[1].getLayoutRadius() * 0.6975;
        },
        fillOpacity: 0.3,
        fill: (...params) => {
          return params[1].seriesColor(params[0]['NYYSFm4bppn6']);
        },
        visible: true,
        x: (...params) => {
          return params[1].getCenter().x();
        },
        y: (...params) => {
          return params[1].getCenter().y();
        }
      }
    },
    {
      name: 'arc_inner',
      type: 'symbol',
      // dataId: 'id0',
      style: {
        interactive: false,
        size: (...params) => {
          console.log('params', params);
          return params[1].getLayoutRadius() * 2 * 0.6975 - 30;
        },
        fillOpacity: 0,
        // fill: 'red',
        lineWidth: 1,
        strokeOpacity: 0.5,
        stroke: {
          gradient: 'conical',
          startAngle: 0,
          endAngle: Math.PI * 2,
          stops: [
            {
              offset: 0,
              color: '#FFF',
              opacity: 0
            },
            {
              offset: 1,
              color: '#FFF',
              opacity: 1
            }
          ]
        },
        visible: true,
        x: (...params) => {
          return params[1].getCenter().x();
        },
        y: (...params) => {
          return params[1].getCenter().y();
        }
      }
    },
    {
      name: 'arc_outter',
      type: 'symbol',
      // dataId: 'id0',
      style: {
        interactive: false,
        size: (...params) => {
          console.log('params-outer', params, params[1].getLayoutRadius());
          return params[1].getLayoutRadius() * 2 * 0.75 + 10;
        },
        fillOpacity: 0,
        // fill: 'red',
        lineWidth: 1,
        strokeOpacity: 0.5,
        stroke: {
          gradient: 'conical',
          startAngle: 0,
          endAngle: Math.PI * 2,
          stops: [
            {
              offset: 0,
              color: '#FFF',
              opacity: 0
            },
            {
              offset: 1,
              color: '#FFF',
              opacity: 1
            }
          ]
        },
        visible: true,
        x: (...params) => {
          return params[1].getCenter().x();
        },
        y: (...params) => {
          return params[1].getCenter().y();
        }
      }
    }
  ],
  data: [
    {
      id: 'data',
      values: [
        {
          NYYSFm4bppn6: '河北',
          WCJbDjWgKp7o: 20
        },
        {
          NYYSFm4bppn6: '山西',
          WCJbDjWgKp7o: 50
        },
        {
          NYYSFm4bppn6: '内蒙古',
          WCJbDjWgKp7o: 40
        },
        {
          NYYSFm4bppn6: '辽宁',
          WCJbDjWgKp7o: 50
        },
        {
          NYYSFm4bppn6: '吉林',
          WCJbDjWgKp7o: 35
        }
      ],
      fields: {
        NYYSFm4bppn6: {
          alias: 'Province',
          domain: ['河北', '山西', '内蒙古', '辽宁', '吉林'],
          sortIndex: 0
        },
        WCJbDjWgKp7o: {
          alias: 'Sales'
        }
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[饼图](link)
