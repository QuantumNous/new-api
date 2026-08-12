# 时序图

[\[配置项\]](../../../option/sequenceChart)

## 简介

在社交媒体、行为监测等场景中，往往需要在线性时间的演进中, 以节点和边的形式展示不同用户不同时间的不同行为, 并且为了更好地从中发现用户的行为偏好, 还需要以柱状图的形式展示行为统计信息。基于线性时间映射的时序图可以展示这种场景下的数据。

## 图表构成

时序图本质上为特定系列和组件组成的组合图。

![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/dfd203ff5e337abea49411b06.png)

时序图是一种用于展示时间序列数据的图表类型，它可以表现出数据在时间上的变化趋势。  
在时序图中，我们推荐至少配置一对事件 link 系列，柱系列可根据需要配置 0 个或若干个:

- [柱系列](../../../option/sequenceChart#series-bar): 以柱状图的形式表示特定时间间隔内的时序数据总数。
- [dot 系列](../../../option/sequenceChart#series-dot): 以点的形式表示特定时间点发生的事件。
- [link 系列](../../../option/sequenceChart#series-link): 以边的形式表示事件与事件之间的关联关系。

注意：[link 系列](../../../option/sequenceChart#series-link)必须通过`'dotSeriesIndex'`属性与 [dot 系列](../../../option/sequenceChart#series-dot)绑定，因为其绘制数据及部分配置依赖于 [dot 系列](../../../option/sequenceChart#series-dot)。

时序图通常还包含以下组件:

- [时间轴](../../../option/sequenceChart#axes-time): 所有系列共用的 x 轴，也是时序数据与图元属性映射的介质。
- [缩略轴](../../../option/sequenceChart#dataZoom): 在时序数据展示过于密集时，会将缩略轴组件与时间轴绑定以"控制时间的缩放"。
- [滚动条](../../../option/sequenceChart#scrollbar): 当并行的事件序列过多，即 y 方向分类过多时，可以通过配置滚动条以“控制 [dot 系列](../../../option/sequenceChart#series-dot)和[link 系列](../../../option/sequenceChart#series-link)的上下滚动”。

## 快速上手

```javascript livedemo
const spec = {
  type: 'sequence',
  color: ['#64b5fc', '#ff8f62'],
  appendPadding: {
    left: 80,
    right: 80
  },
  series: [
    {
      type: 'link',
      dataId: 'dataLinkSeries',
      dotSeriesIndex: 1,
      fromField: 'from',
      toField: 'to',
      tooltip: {
        mark: {
          title: {
            key: 'link info',
            value: 'link info'
          },
          content: [
            {
              hasShape: true,
              shapeType: 'square',
              key: 'from',
              value: datum => datum['from']
            },
            {
              hasShape: true,
              shapeType: 'square',
              key: 'to',
              value: datum => datum['to']
            }
          ]
        }
      },
      arrow: {
        style: {
          visible: false
        }
      },
      link: {
        style: {
          stroke: '#ccc'
        }
      }
    },
    {
      type: 'dot',
      dataId: 'dataDotSeries',
      xField: 'event_time',
      yField: 'player_name',
      dotTypeField: 'event_type',
      titleField: 'player_name',
      highLightSeriesGroup: '',
      height: 500,
      clipHeight: 800,
      title: {
        style: {
          fill: 'rgba(46, 47, 50)'
        }
      },
      subTitle: {
        style: {
          fill: 'rgba(46, 47, 50)',
          dy: 7
        }
      },
      grid: {
        style: {
          visible: false
        }
      },
      symbol: {
        style: {
          visible: false
        }
      },
      tooltip: {
        mark: {
          title: {
            key: 'event info',
            value: 'event info'
          },
          content: [
            {
              hasShape: true,
              shapeType: 'square',
              key: datum => datum['player_name']
            },
            {
              hasShape: false,
              key: 'event_time_stamp',
              value: datum => datum['event_time']
            }
          ]
        }
      }
    }
  ],
  axes: [
    {
      orient: 'top',
      type: 'time',
      range: {
        min: -2209017943000,
        max: -2209015063000
      },
      layers: [
        {
          tickStep: 28800,
          timeFormat: '%Y%m%d'
        },
        {
          tickStep: 28800,
          timeFormat: '%H:%M'
        }
      ]
    }
  ],
  title: {
    id: 'axesRow0',
    text: 'Visualize players minutes played - NBA/Basketball',
    padding: {
      bottom: 50
    },
    textStyle: {
      height: 50,
      lineWidth: 3,
      fill: '#333',
      fontSize: 25,
      fontFamily: 'Times New Roman'
    },
    subtextStyle: {
      character: [
        {
          text: "The purpose of this visualization is to keep track of each player's playing time over the course of the game. This gives a quick overview of the game time, the changes made by the coach and the lineups lined up. ",
          fontFamily: 'Times New Roman',
          fontSize: 14,
          fill: '#333'
        }
      ]
    }
  },
  data: [
    {
      id: 'dataDotSeries',
      values: [
        {
          player_name: 'Deandre Ayton',
          type: 'Deandre Ayton',
          dots: [
            {
              event_time: -2209017943000,
              node_name: 'Deandre Ayton_0_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209017476000,
              node_name: 'Deandre Ayton_0_end_node',
              event_type: 'end'
            },
            {
              event_time: -2209016998000,
              node_name: 'Deandre Ayton_1_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209016057000,
              node_name: 'Deandre Ayton_1_end_node',
              event_type: 'end'
            },
            {
              event_time: -2209015551000,
              node_name: 'Deandre Ayton_2_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209015127000,
              node_name: 'Deandre Ayton_2_end_node',
              event_type: 'end'
            },
            {
              event_time: -2209015116000,
              node_name: 'Deandre Ayton_3_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209015063000,
              node_name: 'Deandre Ayton_3_end_node',
              event_type: 'end'
            }
          ]
        },
        {
          player_name: 'Devin Booker',
          type: 'Devin Booker',
          dots: [
            {
              event_time: -2209017943000,
              node_name: 'Devin Booker_0_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209017293000,
              node_name: 'Devin Booker_0_end_node',
              event_type: 'end'
            },
            {
              event_time: -2209016892000,
              node_name: 'Devin Booker_1_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209015783000,
              node_name: 'Devin Booker_1_end_node',
              event_type: 'end'
            },
            {
              event_time: -2209015380000,
              node_name: 'Devin Booker_2_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209015063000,
              node_name: 'Devin Booker_2_end_node',
              event_type: 'end'
            }
          ]
        },
        {
          player_name: 'Kyle Lowry',
          type: 'Kyle Lowry',
          dots: [
            {
              event_time: -2209017943000,
              node_name: 'Kyle Lowry_0_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209017476000,
              node_name: 'Kyle Lowry_0_end_node',
              event_type: 'end'
            },
            {
              event_time: -2209017223000,
              node_name: 'Kyle Lowry_1_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209016762000,
              node_name: 'Kyle Lowry_1_end_node',
              event_type: 'end'
            },
            {
              event_time: -2209016614000,
              node_name: 'Kyle Lowry_2_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209016057000,
              node_name: 'Kyle Lowry_2_end_node',
              event_type: 'end'
            },
            {
              event_time: -2209015884000,
              node_name: 'Kyle Lowry_3_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209015063000,
              node_name: 'Kyle Lowry_3_end_node',
              event_type: 'end'
            }
          ]
        },
        {
          player_name: 'Jae Crowder',
          type: 'Jae Crowder',
          dots: [
            {
              event_time: -2209017943000,
              node_name: 'Jae Crowder_0_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209017293000,
              node_name: 'Jae Crowder_0_end_node',
              event_type: 'end'
            },
            {
              event_time: -2209016998000,
              node_name: 'Jae Crowder_1_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209016139000,
              node_name: 'Jae Crowder_1_end_node',
              event_type: 'end'
            },
            {
              event_time: -2209015651000,
              node_name: 'Jae Crowder_2_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209015063000,
              node_name: 'Jae Crowder_2_end_node',
              event_type: 'end'
            }
          ]
        },
        {
          player_name: 'Aron Baynes',
          type: 'Aron Baynes',
          dots: [
            {
              event_time: -2209017943000,
              node_name: 'Aron Baynes_0_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209017476000,
              node_name: 'Aron Baynes_0_end_node',
              event_type: 'end'
            },
            {
              event_time: -2209016503000,
              node_name: 'Aron Baynes_1_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209016166000,
              node_name: 'Aron Baynes_1_end_node',
              event_type: 'end'
            }
          ]
        },
        {
          player_name: 'Pascal Siakam',
          type: 'Pascal Siakam',
          dots: [
            {
              event_time: -2209016892000,
              node_name: 'Pascal Siakam_0_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209015788000,
              node_name: 'Pascal Siakam_0_end_node',
              event_type: 'end'
            },
            {
              event_time: -2209015528000,
              node_name: 'Pascal Siakam_1_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209015063000,
              node_name: 'Pascal Siakam_1_end_node',
              event_type: 'end'
            },
            {
              event_time: -2209017943000,
              node_name: 'Pascal Siakam_2_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209017223000,
              node_name: 'Pascal Siakam_2_end_node',
              event_type: 'end'
            }
          ]
        },
        {
          player_name: 'Mikal Bridges',
          type: 'Mikal Bridges',
          dots: [
            {
              event_time: -2209017943000,
              node_name: 'Mikal Bridges_0_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209017650000,
              node_name: 'Mikal Bridges_0_end_node',
              event_type: 'end'
            },
            {
              event_time: -2209016998000,
              node_name: 'Mikal Bridges_1_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209016762000,
              node_name: 'Mikal Bridges_1_end_node',
              event_type: 'end'
            },
            {
              event_time: -2209016503000,
              node_name: 'Mikal Bridges_2_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209016003000,
              node_name: 'Mikal Bridges_2_end_node',
              event_type: 'end'
            },
            {
              event_time: -2209015783000,
              node_name: 'Mikal Bridges_3_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209015063000,
              node_name: 'Mikal Bridges_3_end_node',
              event_type: 'end'
            }
          ]
        },
        {
          player_name: 'Chris Paul',
          type: 'Chris Paul',
          dots: [
            {
              event_time: -2209017943000,
              node_name: 'Chris Paul_0_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209017476000,
              node_name: 'Chris Paul_0_end_node',
              event_type: 'end'
            },
            {
              event_time: -2209016998000,
              node_name: 'Chris Paul_1_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209016057000,
              node_name: 'Chris Paul_1_end_node',
              event_type: 'end'
            },
            {
              event_time: -2209015551000,
              node_name: 'Chris Paul_2_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209015063000,
              node_name: 'Chris Paul_2_end_node',
              event_type: 'end'
            }
          ]
        },
        {
          player_name: 'OG Anunoby',
          type: 'OG Anunoby',
          dots: [
            {
              event_time: -2209017943000,
              node_name: 'OG Anunoby_0_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209017476000,
              node_name: 'OG Anunoby_0_end_node',
              event_type: 'end'
            },
            {
              event_time: -2209017223000,
              node_name: 'OG Anunoby_1_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209016614000,
              node_name: 'OG Anunoby_1_end_node',
              event_type: 'end'
            },
            {
              event_time: -2209016503000,
              node_name: 'OG Anunoby_2_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209016021000,
              node_name: 'OG Anunoby_2_end_node',
              event_type: 'end'
            },
            {
              event_time: -2209015788000,
              node_name: 'OG Anunoby_3_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209015063000,
              node_name: 'OG Anunoby_3_end_node',
              event_type: 'end'
            }
          ]
        },
        {
          player_name: 'Fred VanVleet',
          type: 'Fred VanVleet',
          dots: [
            {
              event_time: -2209016892000,
              node_name: 'Fred VanVleet_0_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209015884000,
              node_name: 'Fred VanVleet_0_end_node',
              event_type: 'end'
            },
            {
              event_time: -2209015651000,
              node_name: 'Fred VanVleet_1_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209015063000,
              node_name: 'Fred VanVleet_1_end_node',
              event_type: 'end'
            },
            {
              event_time: -2209017943000,
              node_name: 'Fred VanVleet_2_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209017223000,
              node_name: 'Fred VanVleet_2_end_node',
              event_type: 'end'
            }
          ]
        },
        {
          player_name: 'Cameron Johnson',
          type: 'Cameron Johnson',
          dots: [
            {
              event_time: -2209017650000,
              node_name: 'Cameron Johnson_0_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209016998000,
              node_name: 'Cameron Johnson_0_end_node',
              event_type: 'end'
            },
            {
              event_time: -2209016762000,
              node_name: 'Cameron Johnson_1_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209016503000,
              node_name: 'Cameron Johnson_1_end_node',
              event_type: 'end'
            },
            {
              event_time: -2209016139000,
              node_name: 'Cameron Johnson_2_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209015651000,
              node_name: 'Cameron Johnson_2_end_node',
              event_type: 'end'
            }
          ]
        },
        {
          player_name: 'Yuta Watanabe',
          type: 'Yuta Watanabe',
          dots: [
            {
              event_time: -2209017476000,
              node_name: 'Yuta Watanabe_0_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209016892000,
              node_name: 'Yuta Watanabe_0_end_node',
              event_type: 'end'
            },
            {
              event_time: -2209016021000,
              node_name: 'Yuta Watanabe_1_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209015651000,
              node_name: 'Yuta Watanabe_1_end_node',
              event_type: 'end'
            }
          ]
        },
        {
          player_name: 'Dario Saric',
          type: 'Dario Saric',
          dots: [
            {
              event_time: -2209017476000,
              node_name: 'Dario Saric_0_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209016998000,
              node_name: 'Dario Saric_0_end_node',
              event_type: 'end'
            },
            {
              event_time: -2209016057000,
              node_name: 'Dario Saric_1_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209015551000,
              node_name: 'Dario Saric_1_end_node',
              event_type: 'end'
            },
            {
              event_time: -2209015127000,
              node_name: 'Dario Saric_2_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209015116000,
              node_name: 'Dario Saric_2_end_node',
              event_type: 'end'
            }
          ]
        },
        {
          player_name: 'Chris Boucher',
          type: 'Chris Boucher',
          dots: [
            {
              event_time: -2209017476000,
              node_name: 'Chris Boucher_0_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209016998000,
              node_name: 'Chris Boucher_0_end_node',
              event_type: 'end'
            },
            {
              event_time: -2209015962000,
              node_name: 'Chris Boucher_1_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209015528000,
              node_name: 'Chris Boucher_1_end_node',
              event_type: 'end'
            }
          ]
        },
        {
          player_name: 'Norman Powell',
          type: 'Norman Powell',
          dots: [
            {
              event_time: -2209017476000,
              node_name: 'Norman Powell_0_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209017119000,
              node_name: 'Norman Powell_0_end_node',
              event_type: 'end'
            },
            {
              event_time: -2209016762000,
              node_name: 'Norman Powell_1_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209016547000,
              node_name: 'Norman Powell_1_end_node',
              event_type: 'end'
            },
            {
              event_time: -2209016057000,
              node_name: 'Norman Powell_2_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209015063000,
              node_name: 'Norman Powell_2_end_node',
              event_type: 'end'
            }
          ]
        },
        {
          player_name: 'Cameron Payne',
          type: 'Cameron Payne',
          dots: [
            {
              event_time: -2209017476000,
              node_name: 'Cameron Payne_0_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209016998000,
              node_name: 'Cameron Payne_0_end_node',
              event_type: 'end'
            },
            {
              event_time: -2209016057000,
              node_name: 'Cameron Payne_1_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209015551000,
              node_name: 'Cameron Payne_1_end_node',
              event_type: 'end'
            }
          ]
        },
        {
          player_name: 'Langston Galloway',
          type: 'Langston Galloway',
          dots: [
            {
              event_time: -2209017293000,
              node_name: 'Langston Galloway_0_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209016998000,
              node_name: 'Langston Galloway_0_end_node',
              event_type: 'end'
            }
          ]
        },
        {
          player_name: 'Jevon Carter',
          type: 'Jevon Carter',
          dots: [
            {
              event_time: -2209017293000,
              node_name: 'Jevon Carter_0_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209016892000,
              node_name: 'Jevon Carter_0_end_node',
              event_type: 'end'
            },
            {
              event_time: -2209016003000,
              node_name: 'Jevon Carter_1_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209015380000,
              node_name: 'Jevon Carter_1_end_node',
              event_type: 'end'
            }
          ]
        },
        {
          player_name: 'Malachi Flynn',
          type: 'Malachi Flynn',
          dots: [
            {
              event_time: -2209017119000,
              node_name: 'Malachi Flynn_0_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209016892000,
              node_name: 'Malachi Flynn_0_end_node',
              event_type: 'end'
            }
          ]
        },
        {
          player_name: 'Alex Len',
          type: 'Alex Len',
          dots: [
            {
              event_time: -2209016998000,
              node_name: 'Alex Len_0_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209016503000,
              node_name: 'Alex Len_0_end_node',
              event_type: 'end'
            },
            {
              event_time: -2209016166000,
              node_name: 'Alex Len_1_start_node',
              event_type: 'start'
            },
            {
              event_time: -2209015962000,
              node_name: 'Alex Len_1_end_node',
              event_type: 'end'
            }
          ]
        },
        {
          player_name: "DeAndre' Bembry",
          type: "DeAndre' Bembry",
          dots: [
            {
              event_time: -2209016547000,
              node_name: "DeAndre' Bembry_0_start_node",
              event_type: 'start'
            },
            {
              event_time: -2209015783000,
              node_name: "DeAndre' Bembry_0_end_node",
              event_type: 'end'
            }
          ]
        }
      ]
    },
    {
      id: 'dataLinkSeries',
      values: [
        {
          from: 'Deandre Ayton_0_start_node',
          to: 'Deandre Ayton_0_end_node'
        },
        {
          from: 'Deandre Ayton_1_start_node',
          to: 'Deandre Ayton_1_end_node'
        },
        {
          from: 'Deandre Ayton_2_start_node',
          to: 'Deandre Ayton_2_end_node'
        },
        {
          from: 'Deandre Ayton_3_start_node',
          to: 'Deandre Ayton_3_end_node'
        },
        {
          from: 'Devin Booker_0_start_node',
          to: 'Devin Booker_0_end_node'
        },
        {
          from: 'Devin Booker_1_start_node',
          to: 'Devin Booker_1_end_node'
        },
        {
          from: 'Devin Booker_2_start_node',
          to: 'Devin Booker_2_end_node'
        },
        {
          from: 'Kyle Lowry_0_start_node',
          to: 'Kyle Lowry_0_end_node'
        },
        {
          from: 'Kyle Lowry_1_start_node',
          to: 'Kyle Lowry_1_end_node'
        },
        {
          from: 'Kyle Lowry_2_start_node',
          to: 'Kyle Lowry_2_end_node'
        },
        {
          from: 'Kyle Lowry_3_start_node',
          to: 'Kyle Lowry_3_end_node'
        },
        {
          from: 'Jae Crowder_0_start_node',
          to: 'Jae Crowder_0_end_node'
        },
        {
          from: 'Jae Crowder_1_start_node',
          to: 'Jae Crowder_1_end_node'
        },
        {
          from: 'Jae Crowder_2_start_node',
          to: 'Jae Crowder_2_end_node'
        },
        {
          from: 'Aron Baynes_0_start_node',
          to: 'Aron Baynes_0_end_node'
        },
        {
          from: 'Aron Baynes_1_start_node',
          to: 'Aron Baynes_1_end_node'
        },
        {
          from: 'Pascal Siakam_0_start_node',
          to: 'Pascal Siakam_0_end_node'
        },
        {
          from: 'Pascal Siakam_1_start_node',
          to: 'Pascal Siakam_1_end_node'
        },
        {
          from: 'Pascal Siakam_2_start_node',
          to: 'Pascal Siakam_2_end_node'
        },
        {
          from: 'Mikal Bridges_0_start_node',
          to: 'Mikal Bridges_0_end_node'
        },
        {
          from: 'Mikal Bridges_1_start_node',
          to: 'Mikal Bridges_1_end_node'
        },
        {
          from: 'Mikal Bridges_2_start_node',
          to: 'Mikal Bridges_2_end_node'
        },
        {
          from: 'Mikal Bridges_3_start_node',
          to: 'Mikal Bridges_3_end_node'
        },
        {
          from: 'Chris Paul_0_start_node',
          to: 'Chris Paul_0_end_node'
        },
        {
          from: 'Chris Paul_1_start_node',
          to: 'Chris Paul_1_end_node'
        },
        {
          from: 'Chris Paul_2_start_node',
          to: 'Chris Paul_2_end_node'
        },
        {
          from: 'OG Anunoby_0_start_node',
          to: 'OG Anunoby_0_end_node'
        },
        {
          from: 'OG Anunoby_1_start_node',
          to: 'OG Anunoby_1_end_node'
        },
        {
          from: 'OG Anunoby_2_start_node',
          to: 'OG Anunoby_2_end_node'
        },
        {
          from: 'OG Anunoby_3_start_node',
          to: 'OG Anunoby_3_end_node'
        },
        {
          from: 'Fred VanVleet_0_start_node',
          to: 'Fred VanVleet_0_end_node'
        },
        {
          from: 'Fred VanVleet_1_start_node',
          to: 'Fred VanVleet_1_end_node'
        },
        {
          from: 'Fred VanVleet_2_start_node',
          to: 'Fred VanVleet_2_end_node'
        },
        {
          from: 'Cameron Johnson_0_start_node',
          to: 'Cameron Johnson_0_end_node'
        },
        {
          from: 'Cameron Johnson_1_start_node',
          to: 'Cameron Johnson_1_end_node'
        },
        {
          from: 'Cameron Johnson_2_start_node',
          to: 'Cameron Johnson_2_end_node'
        },
        {
          from: 'Yuta Watanabe_0_start_node',
          to: 'Yuta Watanabe_0_end_node'
        },
        {
          from: 'Yuta Watanabe_1_start_node',
          to: 'Yuta Watanabe_1_end_node'
        },
        {
          from: 'Dario Saric_0_start_node',
          to: 'Dario Saric_0_end_node'
        },
        {
          from: 'Dario Saric_1_start_node',
          to: 'Dario Saric_1_end_node'
        },
        {
          from: 'Dario Saric_2_start_node',
          to: 'Dario Saric_2_end_node'
        },
        {
          from: 'Chris Boucher_0_start_node',
          to: 'Chris Boucher_0_end_node'
        },
        {
          from: 'Chris Boucher_1_start_node',
          to: 'Chris Boucher_1_end_node'
        },
        {
          from: 'Norman Powell_0_start_node',
          to: 'Norman Powell_0_end_node'
        },
        {
          from: 'Norman Powell_1_start_node',
          to: 'Norman Powell_1_end_node'
        },
        {
          from: 'Norman Powell_2_start_node',
          to: 'Norman Powell_2_end_node'
        },
        {
          from: 'Cameron Payne_0_start_node',
          to: 'Cameron Payne_0_end_node'
        },
        {
          from: 'Cameron Payne_1_start_node',
          to: 'Cameron Payne_1_end_node'
        },
        {
          from: 'Langston Galloway_0_start_node',
          to: 'Langston Galloway_0_end_node'
        },
        {
          from: 'Jevon Carter_0_start_node',
          to: 'Jevon Carter_0_end_node'
        },
        {
          from: 'Jevon Carter_1_start_node',
          to: 'Jevon Carter_1_end_node'
        },
        {
          from: 'Malachi Flynn_0_start_node',
          to: 'Malachi Flynn_0_end_node'
        },
        {
          from: 'Alex Len_0_start_node',
          to: 'Alex Len_0_end_node'
        },
        {
          from: 'Alex Len_1_start_node',
          to: 'Alex Len_1_end_node'
        },
        {
          from: "DeAndre' Bembry_0_start_node",
          to: "DeAndre' Bembry_0_end_node"
        }
      ]
    }
  ]
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

### 关键配置

全局配置:

- `appendPadding`属性用于配置图表的内边距, 建议配置, 否则 dot 和 link 系列的 title 将会与 grid 重叠.

时间轴配置:

- `type`属性用于配置轴的类型, 此处推荐配置`time`用以映射时序数据, 需要注意的是时间轴仅支持时间戳数据
- `layers` 属性用于配置时间轴子母轴的配置, 当轴为时间轴时方可生效. 第 0 项表示母轴, 即下方的轴; 第 1 项表示子轴, 即上方的轴. 通过`timeFormat`配置标签的时间格式. 通过 tickStep 配置时间的间隔秒数.

dot 系列配置:

- `xField` 属性声明为 dot 系列的横坐标字段
- `yField` 属性声明为 dot 系列的纵坐标字段
- `title` 属性声明为 dot 系列的标题字段, 标题位于时间线左侧
- `subTitle` 属性声明为 dot 系列的副标题字段, 标题位于标题下方
- `dotTypeField` 属性声明为 dot 系列的事件点分组字段, 在相同的分组中事件点的颜色相同.
- `highLightSeriesGroup` 属性声明为 dot 系列的高亮分组配置, 当配置`seriesGroupField`时, 可以指定高亮某个特定属性的分组
- `clipHeight` 属性声明为 dot 系列的可视高度

link 系列配置:
link 系列（link series）的数据依赖于事件（event series）系列

- `dotSeriesIndex` 属性声明为关联的 dot 系列的索引
- `fromField` 属性声明为起点位置字段
- `toField` 属性声明为终点位置字段
- `dotTypeField` 属性声明为关系类型字段

## 时序图特性

### 数据

上文提到时序图包含柱系列、dot 系列和 link 系列，它们在时序图中展示的数据及其结构各不相同。

#### 柱系列数据

对于柱系列而言需要展示特定时间间隔内的时序数据总数，属于频率统计的一种，所以结构类似于直方图。

- 两个`数值` 字段，如: `start_time` `end_time`
- 一个`数值`字段，如: `value`

数据定义如下：

```ts
data: [
  {
    name: 'bar',
    values: [
      {
        start_time: 0,
        end_time: 10,
        value: 1
      },
      {
        start_time: 10,
        end_time: 20,
        value: 5
      },
      {
        start_time: 20,
        end_time: 30,
        value: 2
      }
    ]
  }
];
```

#### dot 系列数据

对于 dot 系列而言，既要通过`title` `subTitle` `grid`等图元展示一连串事件构成的序列，又要通过`dot`图元展示具体的事件，所以是一种嵌套类型的数据。

```ts
data: [
  {
    name: 'bar',
    values: [
      {
        type: 'user_did', // 事件序列类型，映射title图元文本
        id: '713019502467512xxxx', // uid / ip / did...，映射subTitle图元文本
        dots: [
          // 事件序列数组
          {
            event_time: 1662061124, // 事件发生的时间，映射
            node_name: '713019502467512xxxx_1662061124_login_device', // 节点名称（字段名称不可变且保证数据唯一性，如果需要绑定link 系列，则该节点名称要与link系列一一对应
            action_type: 'login_device', // 事件类型，映射dot图元颜色
            children: [
              // 事件的附带info，用于展示在tooltip中
              {
                action_type: 'login_device'
              }
            ]
          }
        ]
      },
      {
        id: '683827422612367xxxx',
        type: 'user_did',
        dots: [
          {
            event_time: 1662321122,
            node_name: '683827422612367xxxx_1662321122_login_device',
            action_type: 'login_device',
            children: [
              {
                action_type: 'login_device'
              }
            ]
          },
          {
            event_time: 1662301120,
            node_name: '683827422612367xxxx_1662301120_registry_device',
            action_type: 'registry_device',
            children: [
              {
                action_type: 'registry_device'
              }
            ]
          },
          {
            event_time: 1662503541,
            node_name: '683827422612367xxxx_1662503541_registry_device',
            action_type: 'registry_device',
            children: [
              {
                action_type: 'registry_device'
              }
            ]
          },
          {
            event_time: 1662311121,
            node_name: '683827422612367xxxx_1662311121_login_device',
            action_type: 'login_device',
            children: [
              {
                action_type: 'login_device'
              }
            ]
          },
          {
            event_time: 1662161125,
            node_name: '683827422612367xxxx_1662161125_login_device',
            action_type: 'login_device',
            children: [
              {
                action_type: 'login_device'
              }
            ]
          }
        ]
      }
    ]
  }
];
```

#### link 系列数据

对于 link 系列而言，需要通过两个字段分别指定 link 的起点和终点。
注意：起点字段和终点字段的数据必须与 dot 系列数据中的`node_name`数据一一对应，这样 link 图元在绘制时才能找到对应的起点和终点位置。

```ts
data: [
  {
    name: 'link',
    values: [
      {
        from: '683827468797481xxxx_1662346668_im', // 起点字段
        to: '683827420033672xxxx_1662346668_im', // 终点字段
        action_type: 'im', // 事件关系类型，映射link颜色
        children: [
          // 事件关系的附带info，用于展示在tooltip中
          {
            action_type: 'im',
            msg_id: 800000
          }
        ]
      }
    ]
  }
];
```

### 提示 info 配置

上文提到在事件或事件关系会附带一些额外 info，该 info 通常以`Object`的形式出现，为了将层级结构正确展示在 tooltip 中，dot 和 link 系列内置解析`Object`的方法，用户只需要在`sequenceChart.tooltip.content`中进行如下配置即可。
注意：内置的方法仅解析`children`字段，所以无论是数据，还是此处的 tooltip 配置，都应该保持`children` 字段不变。

```ts
{
  hasShape: true,
  shapeType: 'square',
  key: 'children',
  value: (datum: any) => datum['children']
}
```

下面的例子展示了包含 tooltip 配置的社交媒体时序图:

```javascript livedemo
const spec = {
  type: 'sequence',
  appendPadding: {
    left: 80,
    right: 80
  },
  series: [
    {
      type: 'bar',
      barTitle: 'register',
      dataId: 'register',
      xField: 'start_time',
      x2Field: 'end_time',
      yField: 'value',
      animation: false,
      label: {
        style: {
          visible: false,
          fill: 'black'
        }
      },
      height: 40,
      padding: 10,
      tooltip: {
        visible: true,
        mark: {
          title: {
            key: 'bar info',
            value: 'bar info'
          },
          content: [
            {
              key: 'start_time',
              value: datum => datum['start_time']
            },
            {
              key: 'start_time_stamp',
              hasShape: false,
              value: datum => datum['start_time']
            },
            {
              key: 'end_time',
              value: datum => datum['end_time']
            },
            {
              key: 'end_time_stamp',
              hasShape: false,
              value: datum => datum['end_time']
            },
            {
              key: 'value',
              value: datum => datum['value']
            }
          ]
        }
      }
    },
    {
      type: 'bar',
      barTitle: 'im',
      dataId: 'im',
      xField: 'start_time',
      x2Field: 'end_time',
      yField: 'value',
      animation: false,
      height: 40,
      padding: 10,
      tooltip: {
        visible: true,
        mark: {
          title: {
            key: 'bar in do',
            value: 'bar info'
          },
          content: [
            {
              key: 'start_time',
              value: datum => datum['start_time']
            },
            {
              key: 'start_time_stamp',
              hasShape: false,
              value: datum => datum['start_time']
            },
            {
              key: 'end_time',
              value: datum => datum['end_time']
            },
            {
              key: 'end_time_stamp',
              hasShape: false,
              value: datum => datum['end_time']
            },
            {
              key: 'value',
              value: datum => datum['value']
            }
          ]
        }
      }
    },
    {
      type: 'bar',
      barTitle: 'comment',
      dataId: 'comment',
      xField: 'start_time',
      x2Field: 'end_time',
      yField: 'value',
      animation: false,
      height: 40,
      padding: 10,
      tooltip: {
        visible: true,
        mark: {
          title: {
            key: 'bar info',
            value: 'bar info'
          },
          content: [
            {
              key: 'start_time',
              value: datum => datum['start_time']
            },
            {
              key: 'start_time_stamp',
              hasShape: false,
              value: datum => datum['start_time']
            },
            {
              key: 'end_time',
              value: datum => datum['end_time']
            },
            {
              key: 'end_time_stamp',
              hasShape: false,
              value: datum => datum['end_time']
            },
            {
              key: 'value',
              value: datum => datum['value']
            }
          ]
        }
      }
    },
    {
      type: 'dot',
      dataId: 'dataDotSeries',
      xField: 'event_time',
      yField: 'id',
      seriesGroupField: 'type',
      titleField: 'type',
      subTitleField: 'id',
      dotTypeField: 'action_type',
      highLightSeriesGroup: 'IP',
      clipHeight: 1000,
      title: {
        style: {
          fill: 'rgba(46, 47, 50)'
        }
      },
      subTitle: {
        style: {
          fill: 'rgba(46, 47, 50)',
          dy: 7
        }
      },
      symbol: {
        style: {
          dx: -20
        }
      },
      tooltip: {
        mark: {
          title: {
            key: 'event info',
            value: 'event info'
          },
          content: [
            {
              hasShape: true,
              shapeType: 'square',
              key: datum => datum['type'],
              value: datum => datum['id']
            },
            {
              hasShape: false,
              key: 'event_time_stamp',
              value: datum => datum['event_time']
            },
            {
              hasShape: true,
              shapeType: 'square',
              key: 'action_type',
              value: datum => datum['action_type']
            },
            {
              hasShape: true,
              shapeType: 'square',
              key: 'children',
              value: datum => datum['children']
            }
          ]
        }
      }
    },
    {
      type: 'link',
      dataId: 'dataLinkSeries',
      dotSeriesIndex: 3,
      fromField: 'from',
      toField: 'to',
      dotTypeField: 'action_type',
      tooltip: {
        mark: {
          title: {
            key: 'link info',
            value: 'link info'
          },
          content: [
            {
              hasShape: true,
              shapeType: 'square',
              key: 'time',
              value: datum => datum['from'].split('_')[1]
            },
            {
              hasShape: false,
              key: 'time_stamp',
              value: datum => datum['from'].split('_')[1]
            },
            {
              hasShape: true,
              shapeType: 'square',
              key: 'type',
              value: datum => datum['action_type']
            },
            {
              hasShape: true,
              shapeType: 'square',
              key: 'from',
              value: datum => datum['from']
            },
            {
              hasShape: true,
              shapeType: 'square',
              key: 'to',
              value: datum => datum['to']
            }
          ]
        }
      }
    }
  ],
  dataZoom: [
    {
      orient: 'top',
      xAxisIndex: 0,
      regionIndex: [1, 2, 3, 4],
      start: 0.1,
      endValue: 1662351800,
      startText: {
        formatMethod: text => Math.floor(text)
      },
      endText: {
        formatMethod: text => Math.floor(text)
      }
    }
  ],
  axes: [
    {
      orient: 'top',
      type: 'time',
      layers: [
        {
          tickStep: 28800,
          timeFormat: '%H:%M'
        },
        {
          tickStep: 86400,
          timeFormat: '%Y%m%d'
        }
      ]
    }
  ],
  scrollBar: [
    {
      visible: false,
      start: 0,
      end: 0.3,
      roam: true,
      filterMode: 'axis',
      regionIndex: 4,
      axisIndex: 4
    }
  ],
  data: [
    {
      id: 'register',
      values: [
        {
          start_time: 1662300000,
          end_time: 1662303600,
          value: 1
        },
        {
          start_time: 1662501600,
          end_time: 1662505200,
          value: 1
        }
      ]
    },
    {
      id: 'im',
      values: [
        {
          start_time: 1662177600,
          end_time: 1662181200,
          value: 1
        },
        {
          start_time: 1662210000,
          end_time: 1662213600,
          value: 1
        },
        {
          start_time: 1662246000,
          end_time: 1662249600,
          value: 1
        },
        {
          start_time: 1662278400,
          end_time: 1662282000,
          value: 1
        },
        {
          start_time: 1662310800,
          end_time: 1662314400,
          value: 1
        },
        {
          start_time: 1662343200,
          end_time: 1662346800,
          value: 1
        },
        {
          start_time: 1662379200,
          end_time: 1662382800,
          value: 1
        },
        {
          start_time: 1662411600,
          end_time: 1662415200,
          value: 1
        },
        {
          start_time: 1662444000,
          end_time: 1662447600,
          value: 1
        }
      ]
    },
    {
      id: 'comment',
      values: [
        {
          start_time: 1662048000,
          end_time: 1662051600,
          value: 0
        },
        {
          start_time: 1662051600,
          end_time: 1662055200,
          value: 0
        },
        {
          start_time: 1662055200,
          end_time: 1662058800,
          value: 0
        },
        {
          start_time: 1662058800,
          end_time: 1662062400,
          value: 0
        },
        {
          start_time: 1662062400,
          end_time: 1662066000,
          value: 0
        },
        {
          start_time: 1662066000,
          end_time: 1662069600,
          value: 0
        },
        {
          start_time: 1662069600,
          end_time: 1662073200,
          value: 0
        },
        {
          start_time: 1662073200,
          end_time: 1662076800,
          value: 0
        },
        {
          start_time: 1662076800,
          end_time: 1662080400,
          value: 1
        },
        {
          start_time: 1662080400,
          end_time: 1662084000,
          value: 0
        },
        {
          start_time: 1662084000,
          end_time: 1662087600,
          value: 0
        },
        {
          start_time: 1662087600,
          end_time: 1662091200,
          value: 0
        },
        {
          start_time: 1662091200,
          end_time: 1662094800,
          value: 0
        },
        {
          start_time: 1662094800,
          end_time: 1662098400,
          value: 0
        },
        {
          start_time: 1662098400,
          end_time: 1662102000,
          value: 0
        },
        {
          start_time: 1662102000,
          end_time: 1662105600,
          value: 0
        },
        {
          start_time: 1662105600,
          end_time: 1662109200,
          value: 0
        },
        {
          start_time: 1662109200,
          end_time: 1662112800,
          value: 0
        },
        {
          start_time: 1662112800,
          end_time: 1662116400,
          value: 0
        },
        {
          start_time: 1662116400,
          end_time: 1662120000,
          value: 0
        },
        {
          start_time: 1662120000,
          end_time: 1662123600,
          value: 0
        },
        {
          start_time: 1662123600,
          end_time: 1662127200,
          value: 0
        },
        {
          start_time: 1662127200,
          end_time: 1662130800,
          value: 1
        },
        {
          start_time: 1662130800,
          end_time: 1662134400,
          value: 0
        },
        {
          start_time: 1662134400,
          end_time: 1662138000,
          value: 0
        },
        {
          start_time: 1662138000,
          end_time: 1662141600,
          value: 0
        },
        {
          start_time: 1662141600,
          end_time: 1662145200,
          value: 0
        },
        {
          start_time: 1662145200,
          end_time: 1662148800,
          value: 0
        },
        {
          start_time: 1662148800,
          end_time: 1662152400,
          value: 0
        },
        {
          start_time: 1662152400,
          end_time: 1662156000,
          value: 0
        },
        {
          start_time: 1662156000,
          end_time: 1662159600,
          value: 0
        },
        {
          start_time: 1662159600,
          end_time: 1662163200,
          value: 0
        },
        {
          start_time: 1662163200,
          end_time: 1662166800,
          value: 0
        },
        {
          start_time: 1662166800,
          end_time: 1662170400,
          value: 0
        },
        {
          start_time: 1662170400,
          end_time: 1662174000,
          value: 0
        },
        {
          start_time: 1662174000,
          end_time: 1662177600,
          value: 0
        },
        {
          start_time: 1662177600,
          end_time: 1662181200,
          value: 1
        },
        {
          start_time: 1662181200,
          end_time: 1662184800,
          value: 0
        },
        {
          start_time: 1662184800,
          end_time: 1662188400,
          value: 0
        },
        {
          start_time: 1662188400,
          end_time: 1662192000,
          value: 0
        },
        {
          start_time: 1662192000,
          end_time: 1662195600,
          value: 0
        },
        {
          start_time: 1662195600,
          end_time: 1662199200,
          value: 0
        },
        {
          start_time: 1662199200,
          end_time: 1662202800,
          value: 0
        },
        {
          start_time: 1662202800,
          end_time: 1662206400,
          value: 0
        },
        {
          start_time: 1662206400,
          end_time: 1662210000,
          value: 0
        },
        {
          start_time: 1662210000,
          end_time: 1662213600,
          value: 0
        },
        {
          start_time: 1662213600,
          end_time: 1662217200,
          value: 0
        },
        {
          start_time: 1662217200,
          end_time: 1662220800,
          value: 0
        },
        {
          start_time: 1662220800,
          end_time: 1662224400,
          value: 0
        },
        {
          start_time: 1662224400,
          end_time: 1662228000,
          value: 0
        },
        {
          start_time: 1662228000,
          end_time: 1662231600,
          value: 1
        },
        {
          start_time: 1662231600,
          end_time: 1662235200,
          value: 0
        },
        {
          start_time: 1662235200,
          end_time: 1662238800,
          value: 0
        },
        {
          start_time: 1662238800,
          end_time: 1662242400,
          value: 0
        },
        {
          start_time: 1662242400,
          end_time: 1662246000,
          value: 0
        },
        {
          start_time: 1662246000,
          end_time: 1662249600,
          value: 0
        },
        {
          start_time: 1662249600,
          end_time: 1662253200,
          value: 0
        },
        {
          start_time: 1662253200,
          end_time: 1662256800,
          value: 0
        },
        {
          start_time: 1662256800,
          end_time: 1662260400,
          value: 0
        },
        {
          start_time: 1662260400,
          end_time: 1662264000,
          value: 0
        },
        {
          start_time: 1662264000,
          end_time: 1662267600,
          value: 0
        },
        {
          start_time: 1662267600,
          end_time: 1662271200,
          value: 0
        },
        {
          start_time: 1662271200,
          end_time: 1662274800,
          value: 0
        },
        {
          start_time: 1662274800,
          end_time: 1662278400,
          value: 0
        },
        {
          start_time: 1662278400,
          end_time: 1662282000,
          value: 1
        },
        {
          start_time: 1662282000,
          end_time: 1662285600,
          value: 0
        },
        {
          start_time: 1662285600,
          end_time: 1662289200,
          value: 0
        },
        {
          start_time: 1662289200,
          end_time: 1662292800,
          value: 0
        },
        {
          start_time: 1662292800,
          end_time: 1662296400,
          value: 0
        },
        {
          start_time: 1662296400,
          end_time: 1662300000,
          value: 0
        },
        {
          start_time: 1662300000,
          end_time: 1662303600,
          value: 0
        },
        {
          start_time: 1662303600,
          end_time: 1662307200,
          value: 0
        },
        {
          start_time: 1662307200,
          end_time: 1662310800,
          value: 0
        },
        {
          start_time: 1662310800,
          end_time: 1662314400,
          value: 0
        },
        {
          start_time: 1662314400,
          end_time: 1662318000,
          value: 0
        },
        {
          start_time: 1662318000,
          end_time: 1662321600,
          value: 0
        },
        {
          start_time: 1662321600,
          end_time: 1662325200,
          value: 0
        },
        {
          start_time: 1662325200,
          end_time: 1662328800,
          value: 0
        },
        {
          start_time: 1662328800,
          end_time: 1662332400,
          value: 1
        },
        {
          start_time: 1662332400,
          end_time: 1662336000,
          value: 0
        },
        {
          start_time: 1662336000,
          end_time: 1662339600,
          value: 0
        },
        {
          start_time: 1662339600,
          end_time: 1662343200,
          value: 0
        },
        {
          start_time: 1662343200,
          end_time: 1662346800,
          value: 0
        },
        {
          start_time: 1662346800,
          end_time: 1662350400,
          value: 0
        },
        {
          start_time: 1662350400,
          end_time: 1662354000,
          value: 0
        },
        {
          start_time: 1662354000,
          end_time: 1662357600,
          value: 0
        },
        {
          start_time: 1662357600,
          end_time: 1662361200,
          value: 0
        },
        {
          start_time: 1662361200,
          end_time: 1662364800,
          value: 0
        },
        {
          start_time: 1662364800,
          end_time: 1662368400,
          value: 0
        },
        {
          start_time: 1662368400,
          end_time: 1662372000,
          value: 0
        },
        {
          start_time: 1662372000,
          end_time: 1662375600,
          value: 0
        },
        {
          start_time: 1662375600,
          end_time: 1662379200,
          value: 0
        },
        {
          start_time: 1662379200,
          end_time: 1662382800,
          value: 1
        },
        {
          start_time: 1662382800,
          end_time: 1662386400,
          value: 0
        },
        {
          start_time: 1662386400,
          end_time: 1662390000,
          value: 0
        },
        {
          start_time: 1662390000,
          end_time: 1662393600,
          value: 0
        },
        {
          start_time: 1662393600,
          end_time: 1662397200,
          value: 0
        },
        {
          start_time: 1662397200,
          end_time: 1662400800,
          value: 0
        },
        {
          start_time: 1662400800,
          end_time: 1662404400,
          value: 0
        },
        {
          start_time: 1662404400,
          end_time: 1662408000,
          value: 0
        },
        {
          start_time: 1662408000,
          end_time: 1662411600,
          value: 0
        },
        {
          start_time: 1662411600,
          end_time: 1662415200,
          value: 0
        },
        {
          start_time: 1662415200,
          end_time: 1662418800,
          value: 0
        },
        {
          start_time: 1662418800,
          end_time: 1662422400,
          value: 0
        },
        {
          start_time: 1662422400,
          end_time: 1662426000,
          value: 0
        },
        {
          start_time: 1662426000,
          end_time: 1662429600,
          value: 0
        },
        {
          start_time: 1662429600,
          end_time: 1662433200,
          value: 1
        },
        {
          start_time: 1662433200,
          end_time: 1662436800,
          value: 0
        },
        {
          start_time: 1662436800,
          end_time: 1662440400,
          value: 0
        },
        {
          start_time: 1662440400,
          end_time: 1662444000,
          value: 0
        },
        {
          start_time: 1662444000,
          end_time: 1662447600,
          value: 0
        },
        {
          start_time: 1662447600,
          end_time: 1662451200,
          value: 0
        },
        {
          start_time: 1662451200,
          end_time: 1662454800,
          value: 0
        },
        {
          start_time: 1662454800,
          end_time: 1662458400,
          value: 0
        },
        {
          start_time: 1662458400,
          end_time: 1662462000,
          value: 0
        },
        {
          start_time: 1662462000,
          end_time: 1662465600,
          value: 0
        },
        {
          start_time: 1662465600,
          end_time: 1662469200,
          value: 0
        },
        {
          start_time: 1662469200,
          end_time: 1662472800,
          value: 0
        },
        {
          start_time: 1662472800,
          end_time: 1662476400,
          value: 0
        },
        {
          start_time: 1662476400,
          end_time: 1662480000,
          value: 0
        },
        {
          start_time: 1662480000,
          end_time: 1662483600,
          value: 0
        },
        {
          start_time: 1662483600,
          end_time: 1662487200,
          value: 0
        },
        {
          start_time: 1662487200,
          end_time: 1662490800,
          value: 0
        },
        {
          start_time: 1662490800,
          end_time: 1662494400,
          value: 0
        },
        {
          start_time: 1662494400,
          end_time: 1662498000,
          value: 0
        },
        {
          start_time: 1662498000,
          end_time: 1662501600,
          value: 0
        },
        {
          start_time: 1662501600,
          end_time: 1662505200,
          value: 0
        },
        {
          start_time: 1662505200,
          end_time: 1662508800,
          value: 0
        },
        {
          start_time: 1662508800,
          end_time: 1662512400,
          value: 0
        },
        {
          start_time: 1662512400,
          end_time: 1662516000,
          value: 0
        },
        {
          start_time: 1662516000,
          end_time: 1662519600,
          value: 0
        },
        {
          start_time: 1662519600,
          end_time: 1662523200,
          value: 0
        },
        {
          start_time: 1662523200,
          end_time: 1662526800,
          value: 0
        },
        {
          start_time: 1662526800,
          end_time: 1662530400,
          value: 0
        },
        {
          start_time: 1662530400,
          end_time: 1662534000,
          value: 0
        },
        {
          start_time: 1662534000,
          end_time: 1662537600,
          value: 0
        },
        {
          start_time: 1662537600,
          end_time: 1662541200,
          value: 0
        },
        {
          start_time: 1662541200,
          end_time: 1662544800,
          value: 0
        },
        {
          start_time: 1662544800,
          end_time: 1662548400,
          value: 0
        },
        {
          start_time: 1662548400,
          end_time: 1662552000,
          value: 0
        },
        {
          start_time: 1662552000,
          end_time: 1662555600,
          value: 0
        },
        {
          start_time: 1662555600,
          end_time: 1662559200,
          value: 0
        },
        {
          start_time: 1662559200,
          end_time: 1662562800,
          value: 0
        },
        {
          start_time: 1662562800,
          end_time: 1662566400,
          value: 0
        },
        {
          start_time: 1662566400,
          end_time: 1662570000,
          value: 0
        },
        {
          start_time: 1662570000,
          end_time: 1662573600,
          value: 0
        },
        {
          start_time: 1662573600,
          end_time: 1662577200,
          value: 0
        },
        {
          start_time: 1662577200,
          end_time: 1662580800,
          value: 0
        },
        {
          start_time: 1662580800,
          end_time: 1662584400,
          value: 0
        },
        {
          start_time: 1662584400,
          end_time: 1662588000,
          value: 0
        },
        {
          start_time: 1662588000,
          end_time: 1662591600,
          value: 0
        },
        {
          start_time: 1662591600,
          end_time: 1662595200,
          value: 0
        },
        {
          start_time: 1662595200,
          end_time: 1662598800,
          value: 0
        },
        {
          start_time: 1662598800,
          end_time: 1662602400,
          value: 0
        },
        {
          start_time: 1662602400,
          end_time: 1662606000,
          value: 0
        },
        {
          start_time: 1662606000,
          end_time: 1662609600,
          value: 0
        },
        {
          start_time: 1662609600,
          end_time: 1662613200,
          value: 0
        },
        {
          start_time: 1662613200,
          end_time: 1662616800,
          value: 0
        },
        {
          start_time: 1662616800,
          end_time: 1662620400,
          value: 0
        },
        {
          start_time: 1662620400,
          end_time: 1662624000,
          value: 0
        },
        {
          start_time: 1662624000,
          end_time: 1662627600,
          value: 0
        },
        {
          start_time: 1662627600,
          end_time: 1662631200,
          value: 0
        },
        {
          start_time: 1662631200,
          end_time: 1662634800,
          value: 0
        },
        {
          start_time: 1662634800,
          end_time: 1662638400,
          value: 0
        },
        {
          start_time: 1662638400,
          end_time: 1662642000,
          value: 0
        },
        {
          start_time: 1662642000,
          end_time: 1662645600,
          value: 0
        },
        {
          start_time: 1662645600,
          end_time: 1662649200,
          value: 0
        },
        {
          start_time: 1662649200,
          end_time: 1662652800,
          value: 0
        },
        {
          start_time: 1662652800,
          end_time: 1662656400,
          value: 0
        }
      ]
    },
    {
      id: 'dataDotSeries',
      values: [
        {
          id: '713019502467512xxxx',
          type: 'user_did',
          dots: [
            {
              event_time: 1662061124,
              node_name: '713019502467512xxxx_1662061124_login_device',
              action_type: 'login_device',
              children: [
                {
                  action_type: 'login_device'
                }
              ]
            }
          ]
        },
        {
          id: '683827422612367xxxx',
          type: 'user_did',
          dots: [
            {
              event_time: 1662321122,
              node_name: '683827422612367xxxx_1662321122_login_device',
              action_type: 'login_device',
              children: [
                {
                  action_type: 'login_device'
                }
              ]
            },
            {
              event_time: 1662301120,
              node_name: '683827422612367xxxx_1662301120_registry_device',
              action_type: 'registry_device',
              children: [
                {
                  action_type: 'registry_device'
                }
              ]
            },
            {
              event_time: 1662503541,
              node_name: '683827422612367xxxx_1662503541_registry_device',
              action_type: 'registry_device',
              children: [
                {
                  action_type: 'registry_device'
                }
              ]
            },
            {
              event_time: 1662311121,
              node_name: '683827422612367xxxx_1662311121_login_device',
              action_type: 'login_device',
              children: [
                {
                  action_type: 'login_device'
                }
              ]
            },
            {
              event_time: 1662161125,
              node_name: '683827422612367xxxx_1662161125_login_device',
              action_type: 'login_device',
              children: [
                {
                  action_type: 'login_device'
                }
              ]
            }
          ]
        },
        {
          id: 'bcb395f84ae8882de39d2a8e68d459c177a7b5a0b6884047b0fce1f28d21xxxx',
          type: 'user_email',
          dots: [
            {
              event_time: 1662331123,
              node_name: 'bcb395f84ae8882de39d2a8e68d459c177a7b5a0b6884047b0fce1f28d21xxxx_1662331123_binding_email',
              action_type: 'binding_email',
              children: [
                {
                  action_type: 'binding_email'
                }
              ]
            }
          ]
        },
        {
          id: '93.23.xxx.xx_20200615',
          type: 'IP',
          dots: [
            {
              event_time: 1662361127,
              node_name: '93.23.xxx.xx_20200615_1662361127_registry_ip',
              action_type: 'registry_ip',
              children: [
                {
                  action_type: 'registry_ip'
                }
              ]
            }
          ]
        },
        {
          id: '683827957407865xxxx',
          type: 'user_id',
          dots: [
            {
              event_time: 1662311121,
              node_name: '683827957407865xxxx_1662311121_login_device',
              action_type: 'login_device',
              children: [
                {
                  action_type: 'login_device'
                }
              ]
            }
          ]
        },
        {
          id: '713019589280868xxxx',
          type: 'user_id',
          dots: [
            {
              event_time: 1662061124,
              node_name: '713019589280868xxxx_1662061124_login_device',
              action_type: 'login_device',
              children: [
                {
                  action_type: 'login_device'
                }
              ]
            }
          ]
        },
        {
          id: '25328254226993xxxx',
          type: 'user_id',
          dots: [
            {
              event_time: 1662321122,
              node_name: '25328254226993xxxx_1662321122_login_device',
              action_type: 'login_device',
              children: [
                {
                  action_type: 'login_device'
                }
              ]
            }
          ]
        },
        {
          id: '683827420033672xxxx',
          type: 'user_id',
          dots: [
            {
              event_time: 1662346668,
              node_name: '683827420033672xxxx_1662346668_im',
              action_type: 'im',
              children: [
                {
                  action_type: 'im',
                  msg_id: 800000
                }
              ]
            },
            {
              event_time: 1662480000,
              node_name: '683827420033672xxxx_1662480000_combine',
              action_type: 'combine',
              children: [
                {
                  action_type: 'invite',
                  placeholder: 'placeholder'
                },
                {
                  action_type: 'invite',
                  placeholder: 'placeholder'
                },
                {
                  action_type: 'like',
                  video_id: 1234567890,
                  is_cancel: true
                },
                {
                  action_type: 'report',
                  content: 'report context in string',
                  report_type: 'user',
                  target: 'user_id'
                },
                {
                  action_type: 'follow',
                  is_unfollow: false,
                  source: 1
                },
                {
                  action_type: 'invite',
                  placeholder: 'placeholder'
                },
                {
                  action_type: 'follow',
                  is_unfollow: false,
                  source: 1
                },
                {
                  action_type: 'invite',
                  placeholder: 'placeholder'
                },
                {
                  action_type: 'like',
                  video_id: 1234567890,
                  is_cancel: true
                },
                {
                  action_type: 'report',
                  content: 'report context in string',
                  report_type: 'user',
                  target: 'user_id'
                },
                {
                  action_type: 'invite',
                  placeholder: 'placeholder'
                },
                {
                  action_type: 'follow',
                  is_unfollow: false,
                  source: 1
                },
                {
                  action_type: 'like',
                  video_id: 1234567890,
                  is_cancel: true
                },
                {
                  action_type: 'follow',
                  is_unfollow: false,
                  source: 1
                },
                {
                  action_type: 'report',
                  content: 'report context in string',
                  report_type: 'user',
                  target: 'user_id'
                },
                {
                  action_type: 'follow',
                  is_unfollow: false,
                  source: 1
                },
                {
                  action_type: 'report',
                  content: 'report context in string',
                  report_type: 'user',
                  target: 'user_id'
                },
                {
                  action_type: 'report',
                  content: 'report context in string',
                  report_type: 'user',
                  target: 'user_id'
                },
                {
                  action_type: 'report',
                  content: 'report context in string',
                  report_type: 'user',
                  target: 'user_id'
                },
                {
                  action_type: 'invite',
                  placeholder: 'placeholder'
                },
                {
                  action_type: 'follow',
                  is_unfollow: false,
                  source: 1
                },
                {
                  action_type: 'like',
                  video_id: 1234567890,
                  is_cancel: true
                },
                {
                  action_type: 'like',
                  video_id: 1234567890,
                  is_cancel: true
                },
                {
                  action_type: 'invite',
                  placeholder: 'placeholder'
                },
                {
                  action_type: 'follow',
                  is_unfollow: false,
                  source: 1
                },
                {
                  action_type: 'like',
                  video_id: 1234567890,
                  is_cancel: true
                },
                {
                  action_type: 'report',
                  content: 'report context in string',
                  report_type: 'user',
                  target: 'user_id'
                },
                {
                  action_type: 'like',
                  video_id: 1234567890,
                  is_cancel: true
                },
                {
                  action_type: 'invite',
                  placeholder: 'placeholder'
                },
                {
                  action_type: 'follow',
                  is_unfollow: false,
                  source: 1
                },
                {
                  action_type: 'like',
                  video_id: 1234567890,
                  is_cancel: true
                },
                {
                  action_type: 'report',
                  content: 'report context in string',
                  report_type: 'user',
                  target: 'user_id'
                }
              ]
            },
            {
              event_time: 1662380000,
              node_name: '683827420033672xxxx_1662380000_comment',
              action_type: 'comment',
              children: [
                {
                  action_type: 'comment',
                  comment_id: 3000,
                  content: 'some comment from tiktok user',
                  video_id: 90000001,
                  is_delete: false
                }
              ]
            },
            {
              event_time: 1662280000,
              node_name: '683827420033672xxxx_1662280000_comment',
              action_type: 'comment',
              children: [
                {
                  action_type: 'comment',
                  comment_id: 3000,
                  content: 'some comment from tiktok user',
                  video_id: 90000001,
                  is_delete: false
                }
              ]
            },
            {
              event_time: 1662246669,
              node_name: '683827420033672xxxx_1662246669_im',
              action_type: 'im',
              children: [
                {
                  action_type: 'im',
                  msg_id: 800000
                }
              ]
            },
            {
              event_time: 1662380001,
              node_name: '683827420033672xxxx_1662380001_im',
              action_type: 'im',
              children: [
                {
                  action_type: 'im',
                  msg_id: 800000
                }
              ]
            },
            {
              event_time: 1662130000,
              node_name: '683827420033672xxxx_1662130000_comment',
              action_type: 'comment',
              children: [
                {
                  action_type: 'comment',
                  comment_id: 3000,
                  content: 'some comment from tiktok user',
                  video_id: 90000001,
                  is_delete: false
                }
              ]
            },
            {
              event_time: 1662080000,
              node_name: '683827420033672xxxx_1662080000_comment',
              action_type: 'comment',
              children: [
                {
                  action_type: 'comment',
                  comment_id: 3000,
                  content: 'some comment from tiktok user',
                  video_id: 90000001,
                  is_delete: false
                }
              ]
            },
            {
              event_time: 1662413334,
              node_name: '683827420033672xxxx_1662413334_im',
              action_type: 'im',
              children: [
                {
                  action_type: 'im',
                  msg_id: 800000
                }
              ]
            },
            {
              event_time: 1662313335,
              node_name: '683827420033672xxxx_1662313335_im',
              action_type: 'im',
              children: [
                {
                  action_type: 'im',
                  msg_id: 800000
                }
              ]
            },
            {
              event_time: 1662230000,
              node_name: '683827420033672xxxx_1662230000_comment',
              action_type: 'comment',
              children: [
                {
                  action_type: 'comment',
                  comment_id: 3000,
                  content: 'some comment from tiktok user',
                  video_id: 90000001,
                  is_delete: false
                }
              ]
            },
            {
              event_time: 1662503541,
              node_name: '683827420033672xxxx_1662503541_registry_device',
              action_type: 'registry_device',
              children: [
                {
                  action_type: 'registry_device'
                }
              ]
            },
            {
              event_time: 1662180000,
              node_name: '683827420033672xxxx_1662180000_comment',
              action_type: 'comment',
              children: [
                {
                  action_type: 'comment',
                  comment_id: 3000,
                  content: 'some comment from tiktok user',
                  video_id: 90000001,
                  is_delete: false
                }
              ]
            },
            {
              event_time: 1662430000,
              node_name: '683827420033672xxxx_1662430000_comment',
              action_type: 'comment',
              children: [
                {
                  action_type: 'comment',
                  comment_id: 3000,
                  content: 'some comment from tiktok user',
                  video_id: 90000001,
                  is_delete: false
                }
              ]
            },
            {
              event_time: 1662446667,
              node_name: '683827420033672xxxx_1662446667_im',
              action_type: 'im',
              children: [
                {
                  action_type: 'im',
                  msg_id: 800000
                }
              ]
            },
            {
              event_time: 1662280002,
              node_name: '683827420033672xxxx_1662280002_im',
              action_type: 'im',
              children: [
                {
                  action_type: 'im',
                  msg_id: 800000
                }
              ]
            },
            {
              event_time: 1662180003,
              node_name: '683827420033672xxxx_1662180003_im',
              action_type: 'im',
              children: [
                {
                  action_type: 'im',
                  msg_id: 800000
                }
              ]
            },
            {
              event_time: 1662213336,
              node_name: '683827420033672xxxx_1662213336_im',
              action_type: 'im',
              children: [
                {
                  action_type: 'im',
                  msg_id: 800000
                }
              ]
            },
            {
              event_time: 1662330000,
              node_name: '683827420033672xxxx_1662330000_comment',
              action_type: 'comment',
              children: [
                {
                  action_type: 'comment',
                  comment_id: 3000,
                  content: 'some comment from tiktok user',
                  video_id: 90000001,
                  is_delete: false
                }
              ]
            },
            {
              event_time: 1662161125,
              node_name: '683827420033672xxxx_1662161125_login_device',
              action_type: 'login_device',
              children: [
                {
                  action_type: 'login_device'
                }
              ]
            }
          ]
        },
        {
          id: '683827468797481xxxx',
          type: 'user_id',
          dots: [
            {
              event_time: 1662346668,
              node_name: '683827468797481xxxx_1662346668_im',
              action_type: 'im',
              children: [
                {
                  action_type: 'im',
                  msg_id: 800000
                }
              ]
            },
            {
              event_time: 1662480000,
              node_name: '683827468797481xxxx_1662480000_combine',
              action_type: 'combine',
              children: [
                {
                  action_type: 'switch_accoount'
                },
                {
                  action_type: 'switch_accoount'
                },
                {
                  action_type: 'enter_personal_detail'
                },
                {
                  action_type: 'invite',
                  placeholder: 'placeholder'
                },
                {
                  action_type: 'invite',
                  placeholder: 'placeholder'
                },
                {
                  action_type: 'switch_accoount'
                },
                {
                  action_type: 'like',
                  video_id: 1234567890,
                  is_cancel: true
                },
                {
                  action_type: 'enter_personal_detail'
                },
                {
                  action_type: 'report',
                  content: 'report context in string',
                  report_type: 'user',
                  target: 'user_id'
                },
                {
                  action_type: 'follow',
                  is_unfollow: false,
                  source: 1
                },
                {
                  action_type: 'enter_personal_detail'
                },
                {
                  action_type: 'post_video',
                  video_id: 987654,
                  is_delete: true
                },
                {
                  action_type: 'post_video',
                  video_id: 987654,
                  is_delete: true
                },
                {
                  action_type: 'invite',
                  placeholder: 'placeholder'
                },
                {
                  action_type: 'follow',
                  is_unfollow: false,
                  source: 1
                },
                {
                  action_type: 'invite',
                  placeholder: 'placeholder'
                },
                {
                  action_type: 'like',
                  video_id: 1234567890,
                  is_cancel: true
                },
                {
                  action_type: 'switch_accoount'
                },
                {
                  action_type: 'post_video',
                  video_id: 987654,
                  is_delete: true
                },
                {
                  action_type: 'report',
                  content: 'report context in string',
                  report_type: 'user',
                  target: 'user_id'
                },
                {
                  action_type: 'invite',
                  placeholder: 'placeholder'
                },
                {
                  action_type: 'post_video',
                  video_id: 987654,
                  is_delete: true
                },
                {
                  action_type: 'follow',
                  is_unfollow: false,
                  source: 1
                },
                {
                  action_type: 'like',
                  video_id: 1234567890,
                  is_cancel: true
                },
                {
                  action_type: 'follow',
                  is_unfollow: false,
                  source: 1
                },
                {
                  action_type: 'report',
                  content: 'report context in string',
                  report_type: 'user',
                  target: 'user_id'
                },
                {
                  action_type: 'post_video',
                  video_id: 987654,
                  is_delete: true
                },
                {
                  action_type: 'follow',
                  is_unfollow: false,
                  source: 1
                },
                {
                  action_type: 'report',
                  content: 'report context in string',
                  report_type: 'user',
                  target: 'user_id'
                },
                {
                  action_type: 'report',
                  content: 'report context in string',
                  report_type: 'user',
                  target: 'user_id'
                },
                {
                  action_type: 'switch_accoount'
                },
                {
                  action_type: 'post_video',
                  video_id: 987654,
                  is_delete: true
                },
                {
                  action_type: 'report',
                  content: 'report context in string',
                  report_type: 'user',
                  target: 'user_id'
                },
                {
                  action_type: 'invite',
                  placeholder: 'placeholder'
                },
                {
                  action_type: 'follow',
                  is_unfollow: false,
                  source: 1
                },
                {
                  action_type: 'switch_accoount'
                },
                {
                  action_type: 'switch_accoount'
                },
                {
                  action_type: 'switch_accoount'
                },
                {
                  action_type: 'like',
                  video_id: 1234567890,
                  is_cancel: true
                },
                {
                  action_type: 'enter_personal_detail'
                },
                {
                  action_type: 'enter_personal_detail'
                },
                {
                  action_type: 'like',
                  video_id: 1234567890,
                  is_cancel: true
                },
                {
                  action_type: 'invite',
                  placeholder: 'placeholder'
                },
                {
                  action_type: 'follow',
                  is_unfollow: false,
                  source: 1
                },
                {
                  action_type: 'like',
                  video_id: 1234567890,
                  is_cancel: true
                },
                {
                  action_type: 'switch_accoount'
                },
                {
                  action_type: 'switch_accoount'
                },
                {
                  action_type: 'enter_personal_detail'
                },
                {
                  action_type: 'report',
                  content: 'report context in string',
                  report_type: 'user',
                  target: 'user_id'
                },
                {
                  action_type: 'post_video',
                  video_id: 987654,
                  is_delete: true
                },
                {
                  action_type: 'switch_accoount'
                },
                {
                  action_type: 'enter_personal_detail'
                },
                {
                  action_type: 'switch_accoount'
                },
                {
                  action_type: 'like',
                  video_id: 1234567890,
                  is_cancel: true
                },
                {
                  action_type: 'post_video',
                  video_id: 987654,
                  is_delete: true
                },
                {
                  action_type: 'enter_personal_detail'
                },
                {
                  action_type: 'enter_personal_detail'
                },
                {
                  action_type: 'invite',
                  placeholder: 'placeholder'
                },
                {
                  action_type: 'follow',
                  is_unfollow: false,
                  source: 1
                },
                {
                  action_type: 'like',
                  video_id: 1234567890,
                  is_cancel: true
                },
                {
                  action_type: 'report',
                  content: 'report context in string',
                  report_type: 'user',
                  target: 'user_id'
                },
                {
                  action_type: 'post_video',
                  video_id: 987654,
                  is_delete: true
                },
                {
                  action_type: 'enter_personal_detail'
                },
                {
                  action_type: 'enter_personal_detail'
                },
                {
                  action_type: 'post_video',
                  video_id: 987654,
                  is_delete: true
                },
                {
                  action_type: 'enter_personal_detail'
                },
                {
                  action_type: 'post_video',
                  video_id: 987654,
                  is_delete: true
                },
                {
                  action_type: 'post_video',
                  video_id: 987654,
                  is_delete: true
                },
                {
                  action_type: 'post_video',
                  video_id: 987654,
                  is_delete: true
                }
              ]
            },
            {
              event_time: 1662080000,
              node_name: '683827468797481xxxx_1662080000_combine',
              action_type: 'combine',
              children: [
                {
                  action_type: 'change_profile',
                  old_signature: '1',
                  new_signature: '2',
                  old_nickname: '3',
                  new_nickname: '4',
                  old_avatar_uri: '5',
                  new_avatar_uri: '6'
                },
                {
                  action_type: 'comment',
                  comment_id: 3000,
                  content: 'some comment from tiktok user',
                  video_id: 90000001,
                  is_delete: false
                }
              ]
            },
            {
              event_time: 1662380000,
              node_name: '683827468797481xxxx_1662380000_combine',
              action_type: 'combine',
              children: [
                {
                  action_type: 'comment',
                  comment_id: 3000,
                  content: 'some comment from tiktok user',
                  video_id: 90000001,
                  is_delete: false
                },
                {
                  action_type: 'change_profile',
                  old_signature: '1',
                  new_signature: '2',
                  old_nickname: '3',
                  new_nickname: '4',
                  old_avatar_uri: '5',
                  new_avatar_uri: '6'
                }
              ]
            },
            {
              event_time: 1662280000,
              node_name: '683827468797481xxxx_1662280000_combine',
              action_type: 'combine',
              children: [
                {
                  action_type: 'comment',
                  comment_id: 3000,
                  content: 'some comment from tiktok user',
                  video_id: 90000001,
                  is_delete: false
                },
                {
                  action_type: 'change_profile',
                  old_signature: '1',
                  new_signature: '2',
                  old_nickname: '3',
                  new_nickname: '4',
                  old_avatar_uri: '5',
                  new_avatar_uri: '6'
                }
              ]
            },
            {
              event_time: 1662246669,
              node_name: '683827468797481xxxx_1662246669_im',
              action_type: 'im',
              children: [
                {
                  action_type: 'im',
                  msg_id: 800000
                }
              ]
            },
            {
              event_time: 1662380001,
              node_name: '683827468797481xxxx_1662380001_im',
              action_type: 'im',
              children: [
                {
                  action_type: 'im',
                  msg_id: 800000
                }
              ]
            },
            {
              event_time: 1662130000,
              node_name: '683827468797481xxxx_1662130000_comment',
              action_type: 'comment',
              children: [
                {
                  action_type: 'comment',
                  comment_id: 3000,
                  content: 'some comment from tiktok user',
                  video_id: 90000001,
                  is_delete: false
                }
              ]
            },
            {
              event_time: 1662413334,
              node_name: '683827468797481xxxx_1662413334_im',
              action_type: 'im',
              children: [
                {
                  action_type: 'im',
                  msg_id: 800000
                }
              ]
            },
            {
              event_time: 1662313335,
              node_name: '683827468797481xxxx_1662313335_im',
              action_type: 'im',
              children: [
                {
                  action_type: 'im',
                  msg_id: 800000
                }
              ]
            },
            {
              event_time: 1662301120,
              node_name: '683827468797481xxxx_1662301120_registry_device',
              action_type: 'registry_device',
              children: [
                {
                  action_type: 'registry_device'
                }
              ]
            },
            {
              event_time: 1662361127,
              node_name: '683827468797481xxxx_1662361127_registry_ip',
              action_type: 'registry_ip',
              children: [
                {
                  action_type: 'registry_ip'
                }
              ]
            },
            {
              event_time: 1662230000,
              node_name: '683827468797481xxxx_1662230000_comment',
              action_type: 'comment',
              children: [
                {
                  action_type: 'comment',
                  comment_id: 3000,
                  content: 'some comment from tiktok user',
                  video_id: 90000001,
                  is_delete: false
                }
              ]
            },
            {
              event_time: 1662180000,
              node_name: '683827468797481xxxx_1662180000_combine',
              action_type: 'combine',
              children: [
                {
                  action_type: 'change_profile',
                  old_signature: '1',
                  new_signature: '2',
                  old_nickname: '3',
                  new_nickname: '4',
                  old_avatar_uri: '5',
                  new_avatar_uri: '6'
                },
                {
                  action_type: 'comment',
                  comment_id: 3000,
                  content: 'some comment from tiktok user',
                  video_id: 90000001,
                  is_delete: false
                }
              ]
            },
            {
              event_time: 1662430000,
              node_name: '683827468797481xxxx_1662430000_comment',
              action_type: 'comment',
              children: [
                {
                  action_type: 'comment',
                  comment_id: 3000,
                  content: 'some comment from tiktok user',
                  video_id: 90000001,
                  is_delete: false
                }
              ]
            },
            {
              event_time: 1662446667,
              node_name: '683827468797481xxxx_1662446667_im',
              action_type: 'im',
              children: [
                {
                  action_type: 'im',
                  msg_id: 800000
                }
              ]
            },
            {
              event_time: 1662331123,
              node_name: '683827468797481xxxx_1662331123_binding_email',
              action_type: 'binding_email',
              children: [
                {
                  action_type: 'binding_email'
                }
              ]
            },
            {
              event_time: 1662280002,
              node_name: '683827468797481xxxx_1662280002_im',
              action_type: 'im',
              children: [
                {
                  action_type: 'im',
                  msg_id: 800000
                }
              ]
            },
            {
              event_time: 1662180003,
              node_name: '683827468797481xxxx_1662180003_im',
              action_type: 'im',
              children: [
                {
                  action_type: 'im',
                  msg_id: 800000
                }
              ]
            },
            {
              event_time: 1662213336,
              node_name: '683827468797481xxxx_1662213336_im',
              action_type: 'im',
              children: [
                {
                  action_type: 'im',
                  msg_id: 800000
                }
              ]
            },
            {
              event_time: 1662330000,
              node_name: '683827468797481xxxx_1662330000_comment',
              action_type: 'comment',
              children: [
                {
                  action_type: 'comment',
                  comment_id: 3000,
                  content: 'some comment from tiktok user',
                  video_id: 90000001,
                  is_delete: false
                }
              ]
            }
          ]
        }
      ]
    },
    {
      id: 'dataLinkSeries',
      values: [
        {
          from: '683827468797481xxxx_1662346668_im',
          to: '683827420033672xxxx_1662346668_im',
          action_type: 'im',
          children: [
            {
              action_type: 'im',
              msg_id: 800000
            }
          ]
        },
        {
          from: '683827468797481xxxx_1662480000_combine',
          to: '683827420033672xxxx_1662480000_combine',
          action_type: 'combine',
          children: [
            {
              action_type: 'switch_accoount'
            },
            {
              action_type: 'switch_accoount'
            },
            {
              action_type: 'enter_personal_detail'
            },
            {
              action_type: 'invite',
              placeholder: 'placeholder'
            },
            {
              action_type: 'invite',
              placeholder: 'placeholder'
            },
            {
              action_type: 'switch_accoount'
            },
            {
              action_type: 'like',
              video_id: 1234567890,
              is_cancel: true
            },
            {
              action_type: 'enter_personal_detail'
            },
            {
              action_type: 'report',
              content: 'report context in string',
              report_type: 'user',
              target: 'user_id'
            },
            {
              action_type: 'follow',
              is_unfollow: false,
              source: 1
            },
            {
              action_type: 'enter_personal_detail'
            },
            {
              action_type: 'post_video',
              video_id: 987654,
              is_delete: true
            },
            {
              action_type: 'post_video',
              video_id: 987654,
              is_delete: true
            },
            {
              action_type: 'invite',
              placeholder: 'placeholder'
            },
            {
              action_type: 'follow',
              is_unfollow: false,
              source: 1
            },
            {
              action_type: 'invite',
              placeholder: 'placeholder'
            },
            {
              action_type: 'like',
              video_id: 1234567890,
              is_cancel: true
            },
            {
              action_type: 'switch_accoount'
            },
            {
              action_type: 'post_video',
              video_id: 987654,
              is_delete: true
            },
            {
              action_type: 'report',
              content: 'report context in string',
              report_type: 'user',
              target: 'user_id'
            },
            {
              action_type: 'invite',
              placeholder: 'placeholder'
            },
            {
              action_type: 'post_video',
              video_id: 987654,
              is_delete: true
            },
            {
              action_type: 'follow',
              is_unfollow: false,
              source: 1
            },
            {
              action_type: 'like',
              video_id: 1234567890,
              is_cancel: true
            },
            {
              action_type: 'follow',
              is_unfollow: false,
              source: 1
            },
            {
              action_type: 'report',
              content: 'report context in string',
              report_type: 'user',
              target: 'user_id'
            },
            {
              action_type: 'post_video',
              video_id: 987654,
              is_delete: true
            },
            {
              action_type: 'follow',
              is_unfollow: false,
              source: 1
            },
            {
              action_type: 'report',
              content: 'report context in string',
              report_type: 'user',
              target: 'user_id'
            },
            {
              action_type: 'report',
              content: 'report context in string',
              report_type: 'user',
              target: 'user_id'
            },
            {
              action_type: 'switch_accoount'
            },
            {
              action_type: 'post_video',
              video_id: 987654,
              is_delete: true
            },
            {
              action_type: 'report',
              content: 'report context in string',
              report_type: 'user',
              target: 'user_id'
            },
            {
              action_type: 'invite',
              placeholder: 'placeholder'
            },
            {
              action_type: 'follow',
              is_unfollow: false,
              source: 1
            },
            {
              action_type: 'switch_accoount'
            },
            {
              action_type: 'switch_accoount'
            },
            {
              action_type: 'switch_accoount'
            },
            {
              action_type: 'like',
              video_id: 1234567890,
              is_cancel: true
            },
            {
              action_type: 'enter_personal_detail'
            },
            {
              action_type: 'enter_personal_detail'
            },
            {
              action_type: 'like',
              video_id: 1234567890,
              is_cancel: true
            },
            {
              action_type: 'invite',
              placeholder: 'placeholder'
            },
            {
              action_type: 'follow',
              is_unfollow: false,
              source: 1
            },
            {
              action_type: 'like',
              video_id: 1234567890,
              is_cancel: true
            },
            {
              action_type: 'switch_accoount'
            },
            {
              action_type: 'switch_accoount'
            },
            {
              action_type: 'enter_personal_detail'
            },
            {
              action_type: 'report',
              content: 'report context in string',
              report_type: 'user',
              target: 'user_id'
            },
            {
              action_type: 'post_video',
              video_id: 987654,
              is_delete: true
            },
            {
              action_type: 'switch_accoount'
            },
            {
              action_type: 'enter_personal_detail'
            },
            {
              action_type: 'switch_accoount'
            },
            {
              action_type: 'like',
              video_id: 1234567890,
              is_cancel: true
            },
            {
              action_type: 'post_video',
              video_id: 987654,
              is_delete: true
            },
            {
              action_type: 'enter_personal_detail'
            },
            {
              action_type: 'enter_personal_detail'
            },
            {
              action_type: 'invite',
              placeholder: 'placeholder'
            },
            {
              action_type: 'follow',
              is_unfollow: false,
              source: 1
            },
            {
              action_type: 'like',
              video_id: 1234567890,
              is_cancel: true
            },
            {
              action_type: 'report',
              content: 'report context in string',
              report_type: 'user',
              target: 'user_id'
            },
            {
              action_type: 'post_video',
              video_id: 987654,
              is_delete: true
            },
            {
              action_type: 'enter_personal_detail'
            },
            {
              action_type: 'enter_personal_detail'
            },
            {
              action_type: 'post_video',
              video_id: 987654,
              is_delete: true
            },
            {
              action_type: 'enter_personal_detail'
            },
            {
              action_type: 'post_video',
              video_id: 987654,
              is_delete: true
            },
            {
              action_type: 'post_video',
              video_id: 987654,
              is_delete: true
            },
            {
              action_type: 'post_video',
              video_id: 987654,
              is_delete: true
            }
          ]
        },
        {
          from: '683827468797481xxxx_1662380000_combine',
          to: '683827420033672xxxx_1662380000_comment',
          action_type: 'combine',
          children: [
            {
              action_type: 'comment',
              comment_id: 3000,
              content: 'some comment from tiktok user',
              video_id: 90000001,
              is_delete: false
            },
            {
              action_type: 'change_profile',
              old_signature: '1',
              new_signature: '2',
              old_nickname: '3',
              new_nickname: '4',
              old_avatar_uri: '5',
              new_avatar_uri: '6'
            }
          ]
        },
        {
          from: '683827468797481xxxx_1662280000_combine',
          to: '683827420033672xxxx_1662280000_comment',
          action_type: 'combine',
          children: [
            {
              action_type: 'comment',
              comment_id: 3000,
              content: 'some comment from tiktok user',
              video_id: 90000001,
              is_delete: false
            },
            {
              action_type: 'change_profile',
              old_signature: '1',
              new_signature: '2',
              old_nickname: '3',
              new_nickname: '4',
              old_avatar_uri: '5',
              new_avatar_uri: '6'
            }
          ]
        },
        {
          from: '683827468797481xxxx_1662246669_im',
          to: '683827420033672xxxx_1662246669_im',
          action_type: 'im',
          children: [
            {
              action_type: 'im',
              msg_id: 800000
            }
          ]
        },
        {
          from: '683827468797481xxxx_1662380001_im',
          to: '683827420033672xxxx_1662380001_im',
          action_type: 'im',
          children: [
            {
              action_type: 'im',
              msg_id: 800000
            }
          ]
        },
        {
          from: '683827468797481xxxx_1662130000_comment',
          to: '683827420033672xxxx_1662130000_comment',
          action_type: 'comment',
          children: [
            {
              action_type: 'comment',
              comment_id: 3000,
              content: 'some comment from tiktok user',
              video_id: 90000001,
              is_delete: false
            }
          ]
        },
        {
          from: '683827468797481xxxx_1662080000_combine',
          to: '683827420033672xxxx_1662080000_comment',
          action_type: 'combine',
          children: [
            {
              action_type: 'change_profile',
              old_signature: '1',
              new_signature: '2',
              old_nickname: '3',
              new_nickname: '4',
              old_avatar_uri: '5',
              new_avatar_uri: '6'
            },
            {
              action_type: 'comment',
              comment_id: 3000,
              content: 'some comment from tiktok user',
              video_id: 90000001,
              is_delete: false
            }
          ]
        },
        {
          from: '683827468797481xxxx_1662413334_im',
          to: '683827420033672xxxx_1662413334_im',
          action_type: 'im',
          children: [
            {
              action_type: 'im',
              msg_id: 800000
            }
          ]
        },
        {
          from: '683827468797481xxxx_1662313335_im',
          to: '683827420033672xxxx_1662313335_im',
          action_type: 'im',
          children: [
            {
              action_type: 'im',
              msg_id: 800000
            }
          ]
        },
        {
          from: '25328254226993xxxx_1662321122_login_device',
          to: '683827422612367xxxx_1662321122_login_device',
          action_type: 'login_device',
          children: [
            {
              action_type: 'login_device'
            }
          ]
        },
        {
          from: '683827468797481xxxx_1662301120_registry_device',
          to: '683827422612367xxxx_1662301120_registry_device',
          action_type: 'registry_device',
          children: [
            {
              action_type: 'registry_device'
            }
          ]
        },
        {
          from: '683827468797481xxxx_1662361127_registry_ip',
          to: '93.23.xxx.xx_20200615_1662361127_registry_ip',
          action_type: 'registry_ip',
          children: [
            {
              action_type: 'registry_ip'
            }
          ]
        },
        {
          from: '683827468797481xxxx_1662230000_comment',
          to: '683827420033672xxxx_1662230000_comment',
          action_type: 'comment',
          children: [
            {
              action_type: 'comment',
              comment_id: 3000,
              content: 'some comment from tiktok user',
              video_id: 90000001,
              is_delete: false
            }
          ]
        },
        {
          from: '713019589280868xxxx_1662061124_login_device',
          to: '713019502467512xxxx_1662061124_login_device',
          action_type: 'login_device',
          children: [
            {
              action_type: 'login_device'
            }
          ]
        },
        {
          from: '683827420033672xxxx_1662503541_registry_device',
          to: '683827422612367xxxx_1662503541_registry_device',
          action_type: 'registry_device',
          children: [
            {
              action_type: 'registry_device'
            }
          ]
        },
        {
          from: '683827468797481xxxx_1662180000_combine',
          to: '683827420033672xxxx_1662180000_comment',
          action_type: 'combine',
          children: [
            {
              action_type: 'change_profile',
              old_signature: '1',
              new_signature: '2',
              old_nickname: '3',
              new_nickname: '4',
              old_avatar_uri: '5',
              new_avatar_uri: '6'
            },
            {
              action_type: 'comment',
              comment_id: 3000,
              content: 'some comment from tiktok user',
              video_id: 90000001,
              is_delete: false
            }
          ]
        },
        {
          from: '683827468797481xxxx_1662430000_comment',
          to: '683827420033672xxxx_1662430000_comment',
          action_type: 'comment',
          children: [
            {
              action_type: 'comment',
              comment_id: 3000,
              content: 'some comment from tiktok user',
              video_id: 90000001,
              is_delete: false
            }
          ]
        },
        {
          from: '683827468797481xxxx_1662446667_im',
          to: '683827420033672xxxx_1662446667_im',
          action_type: 'im',
          children: [
            {
              action_type: 'im',
              msg_id: 800000
            }
          ]
        },
        {
          from: '683827468797481xxxx_1662331123_binding_email',
          to: 'bcb395f84ae8882de39d2a8e68d459c177a7b5a0b6884047b0fce1f28d21xxxx_1662331123_binding_email',
          action_type: 'binding_email',
          children: [
            {
              action_type: 'binding_email'
            }
          ]
        },
        {
          from: '683827468797481xxxx_1662280002_im',
          to: '683827420033672xxxx_1662280002_im',
          action_type: 'im',
          children: [
            {
              action_type: 'im',
              msg_id: 800000
            }
          ]
        },
        {
          from: '683827468797481xxxx_1662180003_im',
          to: '683827420033672xxxx_1662180003_im',
          action_type: 'im',
          children: [
            {
              action_type: 'im',
              msg_id: 800000
            }
          ]
        },
        {
          from: '683827957407865xxxx_1662311121_login_device',
          to: '683827422612367xxxx_1662311121_login_device',
          action_type: 'login_device',
          children: [
            {
              action_type: 'login_device'
            }
          ]
        },
        {
          from: null,
          to: null
        },
        {
          from: '683827468797481xxxx_1662213336_im',
          to: '683827420033672xxxx_1662213336_im',
          action_type: 'im',
          children: [
            {
              action_type: 'im',
              msg_id: 800000
            }
          ]
        },
        {
          from: '683827468797481xxxx_1662330000_comment',
          to: '683827420033672xxxx_1662330000_comment',
          action_type: 'comment',
          children: [
            {
              action_type: 'comment',
              comment_id: 3000,
              content: 'some comment from tiktok user',
              video_id: 90000001,
              is_delete: false
            }
          ]
        },
        {
          from: '683827420033672xxxx_1662161125_login_device',
          to: '683827422612367xxxx_1662161125_login_device',
          action_type: 'login_device',
          children: [
            {
              action_type: 'login_device'
            }
          ]
        }
      ]
    }
  ]
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```
