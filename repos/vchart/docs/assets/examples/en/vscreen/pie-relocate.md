---
category: examples
group: vscreen
title: Pie with Relocate
keywords: pieChart,comparison,composition,proportion,circle,animation
cover: /vchart/preview/pie-relocate.gif
option: vscreen
---

# Pie with Relocate

Animation execution process:

1. Entrance animation: executed during the first rendering

- Radial: sector primitives are expanded by angle
- Scale: overall scaling of sector primitives

2. Normal animation: Carousel animation every interval.

- Change size: Sector primitives are enlarged in size sequentially
- Change the center position: The sector primitives are offset outwards in turn with the center of the circle as the center.

This case includes:
Admission: Zoom + Normal: Change center position

## Key option

- `animationAppear`: entrance animation, animation effect during first rendering
- `animationNormal`: Normal animation, after the initial rendering, the animation effect of the chart without any status update, usually executed in a fixed interval rotation
- `animationUpdate`: When the chart updates state, the animation effect of the graphic elements when updating
- `animationEnter`: When the chart updates state, the animation effect of new elements is added
- `animationExit`: When the chart updates state, the animation effect of the primitive when it exits

## Demo source

```javascript livedemo
// normal animation config and util
const relocate_offset = 10;

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
      type: 'growRadiusIn',
      easing: 'linear',
      duration: 1000
    }
  },
  animationNormal: {
    pie: [
      {
        channel: {
          x: {
            from: (...p) => {
              return p[1].attribute.x;
            },
            to: (...p) => {
              const angle = (p[1].attribute.startAngle + p[1].attribute.endAngle) / 2;
              return p[1].attribute.x + relocate_offset * Math.cos(angle);
            }
          },
          y: {
            from: (...p) => {
              return p[1].attribute.y;
            },
            to: (...p) => {
              const angle = (p[1].attribute.startAngle + p[1].attribute.endAngle) / 2;
              return p[1].attribute.y + relocate_offset * Math.sin(angle);
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
          x: {
            from: (...p) => {
              const angle = (p[1].attribute.startAngle + p[1].attribute.endAngle) / 2;
              return p[1].attribute.x + relocate_offset * Math.cos(angle);
            },
            to: (...p) => {
              return p[1].attribute.x;
            }
          },
          y: {
            from: (...p) => {
              const angle = (p[1].attribute.startAngle + p[1].attribute.endAngle) / 2;
              return p[1].attribute.y + relocate_offset * Math.sin(angle);
            },
            to: (...p) => {
              return p[1].attribute.y;
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
  innerRadius: 0.6975,
  radius: 0.75,
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
  // decorate markme
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
