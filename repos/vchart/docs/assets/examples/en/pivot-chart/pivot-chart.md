---
category: examples
group: pivot chart
title: Pivot Chart
keywords: pivotChart
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/preview/pivot-chart.png
link: '../guide/table_type/pivot_chart'
option: PivotChart-indicators-chart#cellType
---

# Perspective combination diagram

Guide: https://visactor.io/vtable/guide/table_type/pivot_chart.

The perspective combination diagram combines the vchart chart library to render into the table, enriching the visual display form and improving the rendering performance.

## Key Configurations

- `PivotChart` Initialize the table type using PivotChart.
- `VTable.register.chartModule('vchart', VChart)` Register a charting library for charting, currently supports VChart
- `cellType: 'chart'` Specify the type chart
- `chartModule: 'vchart'` Specify the registered chart library name
- `chartSpec: {}` Chart specs

## Code demo

```javascript livedemo template=vtable
VTable.register.chartModule('vchart', VChart);
let tableInstance;
fetch('https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/North_American_Superstore_Pivot_Chart_data.json')
  .then(res => res.json())
  .then(data => {
    const columns = [
      {
        dimensionKey: 'Region',
        title: 'Region',
        headerStyle: {
          textStick: true
        }
      },
      'Category'
    ];
    const rows = [
      {
        dimensionKey: 'Order Year',
        title: 'Order Year',
        headerStyle: {
          textStick: true
        }
      },
      'Ship Mode'
    ];
    const indicators = [
      {
        indicatorKey: 'Quantity',
        title: 'Quantity',
        width: 'auto',
        cellType: 'chart',
        chartModule: 'vchart',
        chartSpec: {
          // type: 'common',
          stack: true,
          type: 'bar',
          data: {
            id: 'data',
            fields: {
              //设置xField数据的顺序
              'Sub-Category': {
                sortIndex: 0,
                domain: [
                  'Chairs',
                  'Tables',
                  'Bookcases',
                  'Furnishings',

                  'Binders',
                  'Art',
                  'Storage',
                  'Appliances',
                  'Envelopes',
                  'Fasteners',
                  'Paper',
                  'Labels',
                  'Supplies',
                  'Accessories',
                  'Phones',
                  'Copiers',
                  'Machines'
                ]
              },
              'Segment-Indicator': {
                //设置seriesField数据的顺序 应该设置20001的顺序的 但是按照图例的顺序设置后堆叠效果和3.X不一致
                sortIndex: 1,
                domain: [
                  'Consumer-Quantity',
                  'Corporate-Quantity',
                  'Home Office-Quantity',
                  'Consumer-Sales',
                  'Corporate-Sales',
                  'Home Office-Sales',
                  'Consumer-Profit',
                  'Corporate-Profit',
                  'Home Office-Profit'
                ]
                // lockStatisticsByDomain:  true
              }
            }
          },
          xField: ['Sub-Category'],
          yField: 'Quantity',
          seriesField: 'Segment-Indicator',
          axes: [
            { orient: 'left', visible: true, label: { visible: true } },
            { orient: 'bottom', visible: true }
          ],
          bar: {
            state: {
              selected: {
                fill: 'yellow'
              },
              selected_reverse: {
                // fill: '#ddd'
                opacity: 0.2
              }
            }
          },
          scales: [
            {
              id: 'color',
              type: 'ordinal',
              domain: [
                'Consumer-Quantity',
                'Corporate-Quantity',
                'Home Office-Quantity',
                'Consumer-Sales',
                'Corporate-Sales',
                'Home Office-Sales',
                'Consumer-Profit',
                'Corporate-Profit',
                'Home Office-Profit'
              ],
              range: [
                '#2E62F1',
                '#4DC36A',
                '#FF8406',
                '#FFCC00',
                '#4F44CF',
                '#5AC8FA',
                '#003A8C',
                '#B08AE2',
                '#FF6341',
                '#98DD62',
                '#07A199',
                '#87DBDD'
              ]
            }
          ]
        },
        style: {
          padding: 1
        }
      },
      {
        indicatorKey: 'Sales',
        title: 'Sales & Profit',
        cellType: 'chart',
        chartModule: 'vchart',
        chartSpec: {
          type: 'common',
          series: [
            {
              type: 'bar',
              data: {
                id: 'data1',
                fields: {
                  //设置xField数据的顺序
                  'Sub-Category': {
                    sortIndex: 0,
                    domain: [
                      'Chairs',
                      'Tables',
                      'Bookcases',
                      'Furnishings',

                      'Binders',
                      'Art',
                      'Storage',
                      'Appliances',
                      'Envelopes',
                      'Fasteners',
                      'Paper',
                      'Labels',
                      'Supplies',
                      'Accessories',
                      'Phones',
                      'Copiers',
                      'Machines'
                    ]
                  },
                  'Segment-Indicator': {
                    //设置seriesField数据的顺序 应该设置20001的顺序的 但是按照图例的顺序设置后堆叠效果和3.X不一致
                    sortIndex: 1,
                    domain: [
                      'Consumer-Quantity',
                      'Corporate-Quantity',
                      'Home Office-Quantity',
                      'Consumer-Sales',
                      'Corporate-Sales',
                      'Home Office-Sales',
                      'Consumer-Profit',
                      'Corporate-Profit',
                      'Home Office-Profit'
                    ]
                    // lockStatisticsByDomain:  true
                  }
                }
              },
              stack: true,
              xField: ['Sub-Category'],
              yField: 'Sales',
              seriesField: 'Segment-Indicator',
              bar: {
                state: {
                  selected: {
                    fill: 'yellow'
                  },
                  selected_reverse: {
                    // fill: '#ddd'
                    opacity: 0.2
                  }
                }
              }
            },
            {
              type: 'line',
              data: {
                id: 'data2',
                fields: {
                  //设置xField数据的顺序
                  'Sub-Category': {
                    sortIndex: 0,
                    domain: [
                      'Chairs',
                      'Tables',
                      'Bookcases',
                      'Furnishings',

                      'Binders',
                      'Art',
                      'Storage',
                      'Appliances',
                      'Envelopes',
                      'Fasteners',
                      'Paper',
                      'Labels',
                      'Supplies',

                      'Phones',
                      'Accessories',
                      'Machines',
                      'Copiers'
                    ]
                  },
                  'Segment-Indicator': {
                    //设置seriesField数据的顺序 应该设置20001的顺序的 但是按照图例的顺序设置后堆叠效果和3.X不一致
                    sortIndex: 1,
                    domain: [
                      'Consumer-Quantity',
                      'Corporate-Quantity',
                      'Home Office-Quantity',
                      'Consumer-Sales',
                      'Corporate-Sales',
                      'Home Office-Sales',
                      'Consumer-Profit',
                      'Corporate-Profit',
                      'Home Office-Profit'
                    ]
                    // lockStatisticsByDomain:  true
                  }
                }
              },
              stack: false,
              xField: ['Sub-Category'],
              yField: 'Profit',
              seriesField: 'Segment-Indicator',
              line: {
                state: {
                  selected: {
                    lineWidth: 3
                  },
                  selected_reverse: {
                    lineWidth: 1
                  }
                }
              },
              point: {
                state: {
                  selected: {
                    fill: 'yellow'
                  },
                  selected_reverse: {
                    fill: '#ddd'
                  }
                }
              }
            }
          ],
          scales: [
            {
              id: 'color',
              type: 'ordinal',
              domain: [
                'Consumer-Quantity',
                'Corporate-Quantity',
                'Home Office-Quantity',
                'Consumer-Sales',
                'Corporate-Sales',
                'Home Office-Sales',
                'Consumer-Profit',
                'Corporate-Profit',
                'Home Office-Profit'
              ],
              range: [
                '#2E62F1',
                '#4DC36A',
                '#FF8406',
                '#FFCC00',
                '#4F44CF',
                '#5AC8FA',
                '#003A8C',
                '#B08AE2',
                '#FF6341',
                '#98DD62',
                '#07A199',
                '#87DBDD'
              ]
            }
          ]
          // axes: [
          //   { orient: 'left', visible: true, label: { visible: true } },
          //   { orient: 'bottom', visible: true }
          // ]
        },
        style: {
          padding: 1
        }
      }
    ];
    const option = {
      rows,
      columns,
      indicators,
      indicatorsAsCol: false,
      records: data,
      defaultRowHeight: 200,
      defaultHeaderRowHeight: 50,
      defaultColWidth: 280,
      defaultHeaderColWidth: 100,
      indicatorTitle: '指标',
      autoWrapText: true,
      // widthMode:'adaptive',
      // heightMode:'adaptive',
      corner: {
        titleOnDimension: 'row',
        headerStyle: {
          autoWrapText: true
        }
      },
      legends: {
        orient: 'bottom',
        type: 'discrete',
        data: [
          {
            label: 'Consumer-Quantity',
            shape: {
              fill: '#2E62F1',
              symbolType: 'circle'
            }
          },
          {
            label: 'Consumer-Quantity',
            shape: {
              fill: '#4DC36A',
              symbolType: 'square'
            }
          },
          {
            label: 'Home Office-Quantity',
            shape: {
              fill: '#FF8406',
              symbolType: 'square'
            }
          },
          {
            label: 'Consumer-Sales',
            shape: {
              fill: '#FFCC00',
              symbolType: 'square'
            }
          },
          {
            label: 'Consumer-Sales',
            shape: {
              fill: '#4F44CF',
              symbolType: 'square'
            }
          },
          {
            label: 'Home Office-Sales',
            shape: {
              fill: '#5AC8FA',
              symbolType: 'square'
            }
          },
          {
            label: 'Consumer-Profit',
            shape: {
              fill: '#003A8C',
              symbolType: 'square'
            }
          },
          {
            label: 'Consumer-Profit',
            shape: {
              fill: '#B08AE2',
              symbolType: 'square'
            }
          },
          {
            label: 'Home Office-Profit',
            shape: {
              fill: '#FF6341',
              symbolType: 'square'
            }
          }
        ]
      },
      theme: {
        bodyStyle: {
          borderColor: 'gray',
          borderLineWidth: [1, 0, 0, 1]
        },
        headerStyle: {
          borderColor: 'gray',
          borderLineWidth: [0, 0, 1, 1],
          hover: {
            cellBgColor: '#CCE0FF'
          }
        },
        rowHeaderStyle: {
          borderColor: 'gray',
          borderLineWidth: [1, 1, 0, 0],
          hover: {
            cellBgColor: '#CCE0FF'
          }
        },
        cornerHeaderStyle: {
          borderColor: 'gray',
          borderLineWidth: [0, 1, 1, 0],
          hover: {
            cellBgColor: ''
          }
        },
        cornerRightTopCellStyle: {
          borderColor: 'gray',
          borderLineWidth: [0, 0, 1, 1],
          hover: {
            cellBgColor: ''
          }
        },
        cornerLeftBottomCellStyle: {
          borderColor: 'gray',
          borderLineWidth: [1, 1, 0, 0],
          hover: {
            cellBgColor: ''
          }
        },
        cornerRightBottomCellStyle: {
          borderColor: 'gray',
          borderLineWidth: [1, 0, 0, 1],
          hover: {
            cellBgColor: ''
          }
        },
        rightFrozenStyle: {
          borderColor: 'gray',
          borderLineWidth: [1, 0, 1, 1],
          hover: {
            cellBgColor: ''
          }
        },
        bottomFrozenStyle: {
          borderColor: 'gray',
          borderLineWidth: [1, 1, 0, 1],
          hover: {
            cellBgColor: ''
          }
        },
        selectionStyle: {
          cellBgColor: '',
          cellBorderColor: ''
        },
        frameStyle: {
          borderLineWidth: 0
        }
      }
    };

    tableInstance = new VTable.PivotChart(document.getElementById(CONTAINER_ID), option);
    const { LEGEND_ITEM_CLICK } = VTable.ListTable.EVENT_TYPE;
    tableInstance.on(LEGEND_ITEM_CLICK, args => {
      console.log('LEGEND_ITEM_CLICK', args);
      tableInstance.updateFilterRules([
        {
          filterKey: 'Segment-Indicator',
          filteredValues: args.value
        }
      ]);
    });
    tableInstance.onVChartEvent('click', args => {
      console.log('onVChartEvent click', args);
    });
    tableInstance.onVChartEvent('mouseover', args => {
      console.log('onVChartEvent mouseover', args);
    });
    window.tableInstance = tableInstance;
  });
```
