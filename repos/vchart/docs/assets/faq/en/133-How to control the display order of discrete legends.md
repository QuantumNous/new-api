# How to control the display order of discrete legends?

## Problem Description

As shown in the figure below, how can I control the display order of list legends:

![](/vchart/faq/89-0.png)

## solution

For most charts, the order of the list legend is determined by the order of the grouping fields in the data. We can achieve this through the following methods:

1. Directly adjust the order of data
1. Set the domain of the measurement corresponding to the grouping field
1. If the legend component of the chart provides corresponding configuration, you can also directly operate on the legend data.

The following is an introduction to how to configure on VChart. VChart supports direct configuration of the domain of the grouping field and direct control of the data of the legend component. You can choose which method according to your own needs.

1. Set the domain of the measurement corresponding to the grouping field

As shown in the figure below, you can configure the `domain` attribute of the corresponding field on the `data` attribute, and configure `sortIndex` to indicate sorting according to the declared `domain` attribute, so that you can control the display order of the legend.

Note that by configuring the `domain` of a field on the data it not only affects the order in which the legend is displayed, but also the order in which the data is drawn.

![](/vchart/faq/89-1.png)

2. Customize the display order through the `legends.data` property

In addition, you can also directly modify the order of the legend components to achieve the goal. `legends.data` is a callback type that will pass the drawing order of the legend to the user as a parameter. The user can perform the order or other operations according to their own needs, but it needs Note that the returned data must conform to the format of the legend order.

If you simply want to reverse the order of the legends, you can also directly enable the `legends.reverse` property.

![](/vchart/faq/89-2.png)

## Code Example

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        {
          State: 'AL',
          age: 'Under 5 Years',
          population: 310504,
          type: 'a'
        },
        {
          State: 'AL',
          age: '5 to 13 Years',
          population: 552339,
          type: 'a'
        },
        {
          State: 'AL',
          age: '14 to 17 Years',
          population: 259034,
          type: 'a'
        },
        {
          State: 'AL',
          age: '18 to 24 Years',
          population: 450818,
          type: 'b'
        },
        {
          State: 'AL',
          age: '25 to 44 Years',
          population: 1231572,
          type: 'c'
        },
        {
          State: 'AL',
          age: '45 to 64 Years',
          population: 1215966,
          type: 'd'
        },
        {
          State: 'AL',
          age: '65 Years and Over',
          population: 641667,
          type: 'd'
        },
        {
          State: 'AK',
          age: 'Under 5 Years',
          population: 52083,
          type: 'a'
        },
        {
          State: 'AK',
          age: '5 to 13 Years',
          population: 85640,
          type: 'a'
        },
        {
          State: 'AK',
          age: '14 to 17 Years',
          population: 42153,
          type: 'a'
        },
        {
          State: 'AK',
          age: '18 to 24 Years',
          population: 74257,
          type: 'b'
        },
        {
          State: 'AK',
          age: '25 to 44 Years',
          population: 198724,
          type: 'c'
        },
        {
          State: 'AK',
          age: '45 to 64 Years',
          population: 183159,
          type: 'd'
        },
        {
          State: 'AK',
          age: '65 Years and Over',
          population: 50277,
          type: 'd'
        },
        {
          State: 'AZ',
          age: 'Under 5 Years',
          population: 515910,
          type: 'a'
        },
        {
          State: 'AZ',
          age: '5 to 13 Years',
          population: 828669,
          type: 'a'
        },
        {
          State: 'AZ',
          age: '14 to 17 Years',
          population: 362642,
          type: 'a'
        },
        {
          State: 'AZ',
          age: '18 to 24 Years',
          population: 601943,
          type: 'b'
        },
        {
          State: 'AZ',
          age: '25 to 44 Years',
          population: 1804762,
          type: 'c'
        },
        {
          State: 'AZ',
          age: '45 to 64 Years',
          population: 1523681,
          type: 'd'
        },
        {
          State: 'AZ',
          age: '65 Years and Over',
          population: 862573,
          type: 'd'
        },
        {
          State: 'AR',
          age: 'Under 5 Years',
          population: 202070,
          type: 'a'
        },
        {
          State: 'AR',
          age: '5 to 13 Years',
          population: 343207,
          type: 'a'
        },
        {
          State: 'AR',
          age: '14 to 17 Years',
          population: 157204,
          type: 'a'
        },
        {
          State: 'AR',
          age: '18 to 24 Years',
          population: 264160,
          type: 'b'
        },
        {
          State: 'AR',
          age: '25 to 44 Years',
          population: 754420,
          type: 'c'
        },
        {
          State: 'AR',
          age: '45 to 64 Years',
          population: 727124,
          type: 'd'
        },
        {
          State: 'AR',
          age: '65 Years and Over',
          population: 407205,
          type: 'd'
        },
        {
          State: 'CA',
          age: 'Under 5 Years',
          population: 2704659,
          type: 'a'
        },
        {
          State: 'CA',
          age: '5 to 13 Years',
          population: 4499890,
          type: 'a'
        },
        {
          State: 'CA',
          age: '14 to 17 Years',
          population: 2159981,
          type: 'a'
        },
        {
          State: 'CA',
          age: '18 to 24 Years',
          population: 3853788,
          type: 'b'
        },
        {
          State: 'CA',
          age: '25 to 44 Years',
          population: 10604510,
          type: 'c'
        },
        {
          State: 'CA',
          age: '45 to 64 Years',
          population: 8819342,
          type: 'd'
        },
        {
          State: 'CA',
          age: '65 Years and Over',
          population: 4114496,
          type: 'd'
        },
        {
          State: 'CO',
          age: 'Under 5 Years',
          population: 358280,
          type: 'a'
        },
        {
          State: 'CO',
          age: '5 to 13 Years',
          population: 587154,
          type: 'a'
        },
        {
          State: 'CO',
          age: '14 to 17 Years',
          population: 261701,
          type: 'a'
        },
        {
          State: 'CO',
          age: '18 to 24 Years',
          population: 466194,
          type: 'b'
        },
        {
          State: 'CO',
          age: '25 to 44 Years',
          population: 1464939,
          type: 'c'
        },
        {
          State: 'CO',
          age: '45 to 64 Years',
          population: 1290094,
          type: 'd'
        },
        {
          State: 'CO',
          age: '65 Years and Over',
          population: 511094,
          type: 'd'
        },
        {
          State: 'CT',
          age: 'Under 5 Years',
          population: 211637,
          type: 'a'
        },
        {
          State: 'CT',
          age: '5 to 13 Years',
          population: 403658,
          type: 'a'
        },
        {
          State: 'CT',
          age: '14 to 17 Years',
          population: 196918,
          type: 'a'
        },
        {
          State: 'CT',
          age: '18 to 24 Years',
          population: 325110,
          type: 'b'
        },
        {
          State: 'CT',
          age: '25 to 44 Years',
          population: 916955,
          type: 'c'
        },
        {
          State: 'CT',
          age: '45 to 64 Years',
          population: 968967,
          type: 'd'
        },
        {
          State: 'CT',
          age: '65 Years and Over',
          population: 478007,
          type: 'd'
        }
      ],
      // 方法一，改变 domain
      // Method 1, change the domain,
      fields: {
        age: {
          domain: [
            '65 Years and Over',
            'Under 5 Years',
            '5 to 13 Years',
            '14 to 17 Years',
            '18 to 24 Years',
            '25 to 44 Years',
            '45 to 64 Years'
          ],
          sortIndex: 0
        }
      }
    }
  ],
  xField: ['State', 'type'],
  yField: 'population',
  seriesField: 'age',
  stack: true,
  legends: {
    visible: true,
    orient: 'right'
    // 方法二，改变图例组件数据
    // Method 2, change the legend component data
    // data: (legendData) => {
    //   // legendData 为图例组件的绘制数据，你可以打印下 legendData 看下结构
    //   // legendData is the drawing data of the legend component, you can print legendData to see the structure
    //   console.log(legendData)
    //   return legendData.reverse();
    // }
  },

  color: ['#98abc5', '#8a89a6', '#7b6888', '#6b486b', '#a05d56', '#d0743c', '#ff8c00'],
  axes: [
    {
      orient: 'left',
      label: {
        formatMethod: val => {
          return val / 1000000 + 'M';
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

## Related documents

- [Data Tutorial](https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Data/Data_Types_and_Interface)
- [Data Configuration](<https://www.visactor.io/vchart/option/barChart#data(IDataType%7CIDataType%5B%5D).IDataValues.id>)
- [Legend Tutorial](https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Legend)
- [Legend configuration](https://www.visactor.io/vchart/option/barChart#legends-discrete.type)
