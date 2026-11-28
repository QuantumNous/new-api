---
category: examples
group: sequence chart
title: NBA运动员时序图
keywords: sequence,comparison,relationShip,line,scatter,title,axis
order: 13-1
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/sequence-chart/NBA-player-event.png
option: sequenceChart
---

# NBA 运动员时序图

NBA 运动员时序图跟踪每个运动员的运球时间. 用户可以快速了解比赛时间、教练所做的改变以及参赛阵容.
该用例仅配置 dot 或 link 系列, 而不包柱系列. 如果需要展示纯粹的时序数据, 可以参考该用例.

## 关键配置

整个时序图从上到下分为: 时间轴组件、dot 和 link 系列(dot series & link series)

全局配置:

- `appendPadding`属性用于配置图表的内边距, 建议配置, 否则 dot 和 link 系列的 title 将会与 gridline 重叠.

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

## 代码演示

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
            key: 'link 信息',
            value: 'link 信息'
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
            key: 'event 信息',
            value: 'event 信息'
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

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[柱状图](link)
