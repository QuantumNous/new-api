import VChart from '@visactor/vchart';
import type { IActorActionContext, VChartActor, IVChartActorAvatar, Player, BaseActor } from '@internal/story-player';
import { ActorType, createElement, PLAYER_PREFIX } from '@internal/story-player';

const chartContainerStyle: Partial<CSSStyleDeclaration> = {
  position: 'absolute',
  width: '60px',
  height: '60px',
  padding: '10px 20px 30px 20px',
  background: 'white',
  border: '1px solid #F0F0F0',
  boxShadow: '0px 4px 4px 0px rgba(0, 0, 0, 0.05)',
  opacity: '0',
  boxSizing: 'content-box'
};

const chartTitleStyle: Partial<CSSStyleDeclaration> = {
  position: 'absolute',
  top: '70px',
  left: '0px',
  width: '100px',
  textAlign: 'center',
  color: '#1A1A1A',
  fontSize: '8px'
};

export const chartMap: Array<{
  spec: any;
  title: string;
}> = [
  {
    title: 'Timeline Chart',
    spec: {
      type: 'rangeColumn',
      data: [
        {
          id: 'id0',
          values: [
            { type: 'a', value: 0.36, value2: 0.06 },
            { type: 'b', value: 0.66, value2: 0.26 },
            { type: 'c', value: 0.4, value2: 0.0 },
            { type: 'd', value: 0.6, value2: 0.2 }
          ]
        }
      ],
      direction: 'horizontal',
      maxField: 'value',
      minField: 'value2',
      yField: 'type',
      label: {
        style: {
          visible: false
        }
      },
      barMaxWidth: 5,
      bar: {
        maxWidth: 2,
        style: {
          maxWidth: 2
        }
      },
      axes: [
        {
          orient: 'bottom',
          type: 'linear',
          tick: {
            visible: false
          },
          domainLine: { visible: true },
          label: { visible: false },
          grid: { visible: false }
        },
        {
          orient: 'left',
          type: 'band',
          domainLine: { visible: false },
          grid: {
            visible: false
          },
          tick: {
            visible: false
          },
          label: { visible: false }
        }
      ]
    }
  },
  {
    title: 'Bar Chart',
    spec: {
      type: 'bar',
      data: [
        {
          name: 'data',
          values: [
            {
              x: 'Mon',
              y: 100,
              type: '销售额'
            },
            {
              x: 'Tues',
              y: 66,
              type: '销售额'
            },
            {
              x: 'Wed',
              y: 95,
              type: '销售额'
            },
            {
              x: 'Mon',
              y: 43,
              type: '利润'
            },
            {
              x: 'Tues',
              y: 80,
              type: '利润'
            },
            {
              x: 'Wed',
              y: 68,
              type: '利润'
            }
          ]
        }
      ],
      xField: ['x', 'type'],
      yField: 'y',
      seriesField: 'type',
      bar: {
        style: {
          fill: {
            gradient: 'linear',
            stops: [
              {
                offset: 1
              },
              {
                offset: 0,
                opacity: 0.6
              }
            ]
          }
        },
        state: {
          selected: {
            stroke: '#000',
            strokeWidth: 1
          }
        }
      },
      label: {
        style: {
          visible: false
        }
      },
      color: ['#4CC9E4', '#4954E6'],
      axes: [
        {
          orient: 'bottom',
          // visible: false,
          tick: {
            visible: false
          },
          label: { visible: false },
          grid: { visible: false }
        },
        {
          orient: 'left',
          // visible: false,
          grid: {
            visible: false
          },
          tick: {
            visible: false
          },
          label: { visible: false }
        }
      ]
    }
  },
  {
    title: 'Line/Area Chart',
    spec: {
      type: 'common',
      series: [
        {
          type: 'area',
          data: {
            id: 'data2',
            values: [
              { x: 1, y: 70, type: 'a' },
              { x: 2, y: 20, type: 'a' },
              { x: 3, y: 30, type: 'a' },
              { x: 4, y: 10, type: 'a' },

              { x: 1, y: 70, type: 'b' },
              { x: 2, y: 20, type: 'b' },
              { x: 3, y: 30, type: 'b' },
              { x: 4, y: 10, type: 'b' }
            ]
          },
          xField: 'x',
          yField: 'y',
          seriesField: 'type',
          point: {
            visible: false
          }
        }
      ],
      axes: [
        {
          orient: 'left',
          label: { visible: false },
          tick: { visible: false },
          grid: { visible: false }
        },
        {
          orient: 'bottom',
          type: 'band',
          label: { visible: false },
          tick: { visible: false },
          grid: { visible: false }
        }
      ]
    }
  },
  {
    title: 'Pie Chart',
    spec: {
      type: 'pie',
      data: [
        {
          name: 'data1',
          values: [
            {
              value: 348,
              name: '中介渠道: 34.8%'
            },
            {
              value: 152,
              name: '会员: 15.2%'
            },
            {
              value: 500,
              name: '散客: 50%'
            }
          ]
        }
      ],
      valueField: 'value',
      categoryField: 'name',
      radius: 1,
      innerRadius: 0
    }
  },
  {
    title: 'Scatter Chart',
    spec: {
      type: 'common',
      series: [
        {
          type: 'scatter',
          data: {
            id: 'data2',
            values: [
              { x: 1, y: 70, type: 'a' },
              { x: 2, y: 20, type: 'a' },
              { x: 3, y: 30, type: 'a' },
              { x: 4, y: 10, type: 'a' },

              { x: 1, y: 70, type: 'b' },
              { x: 2, y: 20, type: 'b' },
              { x: 3, y: 30, type: 'b' },
              { x: 4, y: 10, type: 'b' }
            ]
          },
          xField: 'x',
          yField: 'y',
          seriesField: 'type',
          point: {
            style: {
              size: 4
            }
          }
        }
      ],
      axes: [
        {
          orient: 'left',
          label: { visible: false },
          tick: { visible: false },
          grid: { visible: false }
        },
        {
          orient: 'bottom',
          type: 'band',
          label: { visible: false },
          tick: { visible: false },
          grid: { visible: false }
        }
      ]
    }
  },
  {
    title: 'Rose Chart',
    spec: {
      type: 'rose',
      data: [
        {
          id: 'id0',
          values: [
            { type: 'A', value: 608 },
            { type: 'B', value: 680 },
            { type: 'C', value: 727 },
            { type: 'D', value: 673 },
            { type: 'E', value: 815 }
          ]
        }
      ],
      radius: 1,
      innerRadius: 0.2,
      categoryField: 'type',
      valueField: 'value',
      seriesField: 'type'
    }
  },
  {
    title: 'Radar Chart',
    spec: {
      type: 'radar',
      data: [
        {
          id: 'id0',
          values: [
            {
              theta: 0,
              type: 'A',
              value: 833
            },
            {
              theta: 1,
              type: 'A',
              value: 898
            },
            {
              theta: 2,
              type: 'A',
              value: 672
            },
            {
              theta: 3,
              type: 'A',
              value: 889
            },
            {
              theta: 4,
              type: 'A',
              value: 889
            },
            {
              theta: 5,
              type: 'A',
              value: 658
            },
            {
              theta: 6,
              type: 'A',
              value: 822
            },
            {
              theta: 7,
              type: 'A',
              value: 825
            },
            {
              theta: 0,
              type: 'B',
              value: 659
            },
            {
              theta: 1,
              type: 'B',
              value: 896
            },
            {
              theta: 2,
              type: 'B',
              value: 822
            },
            {
              theta: 3,
              type: 'B',
              value: 874
            },
            {
              theta: 4,
              type: 'B',
              value: 742
            },
            {
              theta: 5,
              type: 'B',
              value: 878
            },
            {
              theta: 6,
              type: 'B',
              value: 643
            },
            {
              theta: 7,
              type: 'B',
              value: 604
            }
          ]
        }
      ],
      categoryField: 'theta',
      valueField: 'value',
      seriesField: 'type',
      line: {
        style: {
          strokeWidth: 2
        }
      },
      point: {
        style: {
          size: 2,
          strokeWidth: 1
        }
      },
      startAngle: 90,
      axes: [
        {
          orient: 'angle',
          domainLine: { visible: true, smooth: false },
          label: {
            visible: false
          }
        },
        {
          orient: 'radius',
          domainLine: { visible: false, smooth: false },
          label: {
            visible: false
          },
          grid: { visible: false }
        }
      ],
      legends: {
        visible: false
      },
      label: {
        visible: false
      },
      animationAppear: {
        preset: 'clipIn'
      }
    }
  },
  {
    title: 'Word Cloud',
    spec: {
      type: 'wordCloud',
      padding: 0,
      data: {
        name: 'baseData',
        values: [
          {
            challenge_id: 1658490688121879,
            challenge_name: '宅家剧场',
            sum_count: 128
          },
          {
            challenge_id: 1640007327696910,
            challenge_name: '我的观影报告',
            sum_count: 103
          },
          {
            challenge_id: 1557656100811777,
            challenge_name: '抖瓜小助手',
            sum_count: 76
          },
          {
            challenge_id: 1553513807372289,
            challenge_name: '搞笑',
            sum_count: 70
          },
          {
            challenge_id: 1599321527572563,
            challenge_name: '我要上热门',
            sum_count: 69
          }
        ]
      },
      nameField: 'challenge_name',
      valueField: 'sum_count',
      seriesField: 'challenge_name',
      wordCloudConfig: {
        drawOutOfBound: 'clip'
      },
      maskShape: 'circle',
      fontSizeRange: [5, 8]
    }
  },
  {
    title: 'Treemap Chart',
    spec: {
      type: 'treemap',
      data: [
        {
          id: 'data',
          values: [
            {
              name: 'Second',
              children: [
                {
                  name: 'B2',
                  value: 98
                },
                {
                  name: 'B3',
                  value: 56
                }
              ]
            },
            {
              name: 'First',
              children: [
                {
                  name: 'A2',
                  value: 60
                },
                {
                  name: 'A3',
                  value: 30
                }
              ]
            },
            {
              name: 'Third',
              children: [
                {
                  name: 'C1',
                  value: 33
                },
                {
                  name: 'C2',
                  value: 30
                },
                {
                  name: 'C3',
                  value: 40
                }
              ]
            },
            {
              name: 'Fourth',
              children: [
                {
                  name: 'D4',
                  value: 64
                },
                {
                  name: 'D5',
                  value: 60
                }
              ]
            }
          ]
        }
      ],
      categoryField: 'name',
      valueField: 'value',
      legends: { visible: false },
      nodePadding: 1,
      nonLeaf: {
        visible: false
      },
      nonLeafLabel: {
        visible: false
      },
      label: {
        visible: false
      }
    }
  },
  {
    title: 'Sunburst Chart',
    spec: {
      type: 'sunburst',

      offsetX: 0,
      offsetY: 0,

      categoryField: 'name',
      valueField: 'value',
      outerRadius: 1,
      innerRadius: 0,
      gap: 0,
      labelLayout: {
        align: 'start',
        rotate: 'radial',
        offset: 60
      },
      sunburst: {
        visible: true,
        style: {
          fillOpacity: (datum: any) => {
            return datum.isLeaf ? 0.4 : 0.8;
          }
        }
      },
      label: {
        visible: false
      },
      data: [
        {
          id: 'data',
          values: [
            {
              name: 'Grandpa',
              children: [
                {
                  name: 'Uncle Leo',
                  value: 15,
                  children: [
                    {
                      name: 'Cousin Jack',
                      value: 2
                    },
                    {
                      name: 'Cousin Mary',
                      value: 5,
                      children: [
                        {
                          name: 'Jackson',
                          value: 2
                        }
                      ]
                    },
                    {
                      name: 'Cousin Ben',
                      value: 4
                    }
                  ]
                },
                {
                  name: 'Father',
                  value: 10,
                  children: [
                    {
                      name: 'Me',
                      value: 5
                    },
                    {
                      name: 'Brother Peter',
                      value: 1
                    }
                  ]
                }
              ]
            },
            {
              name: 'Nancy',
              children: [
                {
                  name: 'Uncle Nike',
                  children: [
                    {
                      name: 'Cousin Betty',
                      value: 1
                    },
                    {
                      name: 'Cousin Jenny',
                      value: 2
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  }
];

export const pageTitleActorChart = (player: Player, actorMap: Record<string, BaseActor>) => {
  chartMap.forEach(({ title, spec }, i) => {
    actorMap[`pageTitleActorChart${i}`] = player.createActor<VChartActor>(ActorType.vchart, {
      name: 'smallChart: ' + title,
      createAvatar(context: IActorActionContext) {
        const container = createElement('div', [`${PLAYER_PREFIX}-element-${context.action.id}`], {
          ...chartContainerStyle,
          top: i < 5 ? '50px' : '570px',
          left: `${260 + 165 * (i % 5)}px`
        });
        const dom = createElement('div', [], {
          width: '60px',
          height: '60px'
        });
        container.appendChild(dom);
        const text = createElement('div', [], {
          ...chartTitleStyle
        });
        text.innerText = title;
        container.appendChild(text);
        const vchart = new VChart(
          {
            padding: 10,
            ...spec,
            width: 60,
            height: 60
          },
          { dom }
        );
        return {
          dom: container,
          vchart
        } as IVChartActorAvatar;
      }
    });
  });
};
