# Sequence Chart

[\[Configuration Guide\]](../../../option/sequenceChart)

## Introduction

In social media, behavior monitoring, and other scenarios, it is often necessary to display different behaviors of different users at different times in the form of nodes and edges in linear time evolution. In order to better discover users' behavior preferences, it is also necessary to display behavior statistical information in the form of bar charts. The sequence chart based on linear time mapping can display data in this scenario.

## Chart Structure

The sequence chart is essentially a combination of specific series and components.

![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/dfd203ff5e337abea49411b06.png)

The sequence chart is a chart type used to display time series data, which can show the changes in data over time.
In a sequence chart, we recommend configuring at least one pair of event link series, while the bar series can be configured with 0 or several as needed:

- [Bar Series](../../../option/sequenceChart#series-bar): Represents the total count of time series data within a specific time interval in the form of a bar chart.
- [dot series](../../../option/sequenceChart#series-dot): Represents events occurring at a specific time point in the form of dots.
- [link series](../../../option/sequenceChart#series-link): Represents the relationships between events in the form of edges.

Note: [link series](../../../option/sequenceChart#series-link) must be bound to the [dot series](../../../option/sequenceChart#series-dot) through the `'dotSeriesIndex'` attribute because its drawing data and some configurations depend on the [dot series](../../../option/sequenceChart#series-dot).

Sequence charts typically also include the following components:

- [Time Axis](../../../option/sequenceChart#axes-time): The x-axis shared by all series, and the medium for mapping time-series data to graphic attributes.
- [Zoom Axis](../../../option/sequenceChart#dataZoom): When the sequence data is too dense, the zoom axis component will be bound to the time axis to "control the zoom of time."
- [Scrollbar](../../../option/sequenceChart#scrollbar): When there are too many parallel event series, i.e., too many categories in the y-direction, the scrollbar can be configured to "control the scrolling of the [dot series](../../../option/sequenceChart#series-dot) and [link series](../../../option/sequenceChart#series-link)."

## Quick Start

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

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

### Key Configurations

Global configurations:

- The `appendPadding` attribute is used to configure the chart's padding. It is recommended that this be configured, otherwise, the dot and link series' title will overlap with the grid.

Time Axis Configuration:

- The `type` attribute is used to configure the axis type. Here, it is recommended to configure `time` to map time series data; note that the time axis only supports timestamp data.
- The `layers` attribute is used to configure the parent and child axis configurations for the time axis, which is effective only when the axis is a time axis. The 0th item represents the parent axis, i.e., the bottom axis; the 1st item represents the child axis, i.e., the top axis. Configure the time format of the label through `timeFormat`. Configure the interval in seconds through tickStep.

dot series configuration:

- The `xField` attribute declares the horizontal coordinate field for the dot series.
- The `yField` attribute declares the vertical coordinate field for the dot series.
- The `title` attribute declares the title field for the dot series; the title is located to the left of the timeline.
- The `subTitle` attribute declares the subtitle field for the dot series; the subtitle is located below the title.
- The `dotTypeField` attribute declares the event point grouping field for the dot series; event points in the same group have the same color.
- The `highLightSeriesGroup` attribute declares the highlight group configuration for the dot series; when configuring the `seriesGroupField`, you can specify a specific attribute group to be highlighted.
- The `clipHeight` attribute declares the visible height of the dot series.

link series configuration:
The link series data depends on the event series data.

- The `dotSeriesIndex` attribute declares the index of the associated dot series.
- The `fromField` attribute declares the starting position field.
- The `toField` attribute declares the ending position field.
- The `dotTypeField` attribute declares the relationship type field.

## Sequence Chart Features

### Data

The sequence chart is mentioned above, including the bar series, dot series, and link series, which display different data and structures in the sequence chart.

#### Bar Series Data

For the bar series, it is necessary to display the total count of time series data within a specific time interval, which belongs to a type of frequency statistics, so its structure is similar to histograms.

- Two `numeric` fields, such as: `start_time` `end_time`
- One `numeric` field, such as: `value`

The data is defined as follows:

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

#### dot series data

For the dot series, it needs to display a sequence of events made up of `title` `subTitle` `grid` and other graphics, as well as specific events in the form of `dot` graphics, so it is a nested data type.

```ts
data: [
  {
    name: 'bar',
    values: [
      {
        type: 'user_did', // Event sequence type, mapping title graphic text
        id: '713019502467512xxxx', // uid / ip / did..., mapping subTitle graphic text
        dots: [
          // Event sequence array
          {
            event_time: 1662061124, // The time the event occurred, mapping
            node_name: '713019502467512xxxx_1662061124_login_device', // Node name (field name cannot be changed and must be unique, if the link series needs to be bound, the node name must correspond to the link series one by one.
            action_type: 'login_device', // Event type, mapping to dot graphic color
            children: [
              // Additional information about the event, used to display in tooltip
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

#### link series data

For the link series, two fields need to be specified to specify the beginning and end of the link.
Note: The start field and end field data must correspond one-to-one with the `node_name` data in the dot series data so that the link graphic can find the corresponding start and end positions when drawing.

```ts
data: [
  {
    name: 'link',
    values: [
      {
        from: '683827468797481xxxx_1662346668_im', // Start field
        to: '683827420033672xxxx_1662346668_im', // End field
        action_type: 'im', // Event relationship type, mapping link color
        children: [
          // Additional information about the event relationship, used to display in tooltip
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

### Tooltip Configuration

As mentioned above, events or event relationships will come with some additional information,

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

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```
