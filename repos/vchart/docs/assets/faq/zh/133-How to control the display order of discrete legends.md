# 如何控制离散图例的显示顺序?

## 问题描述

如下图所示，我该如何控制列表型图例的显示顺序：

![](/vchart/faq/89-0.png)

## 解决方案

对于大部分的图表来说，列表型图例的顺序是由数据中分组字段的顺序决定的，我们可以通过如下几种方法来实现：

1.  直接调整数据的顺序
1.  设置分组字段对应度量的 domain
1.  如果图表的图例组件有提供相应配置的话，也可以直接对图例的数据进行操作

下面就介绍下在 VChart 上如何进行配置，VChart 即支持直接配置分组字段的 domain 也支持直接控制图例组件的数据，你可以根据你自己的需要选择哪种方法。

1.  设置分组字段对应度量的 domain

如下图所示，可以在 `data` 属性上配置对应字段的 `domain` 属性，同时配置 `sortIndex` 表示按照声明的 `domain` 属性进行排序，这样就可以控制图例的显示顺序了。

注意通过在数据上配置字段的 `domain` 它不仅会影响图例的显示顺序，也会影响数据的绘制顺序。

![](/vchart/faq/89-1.png)

2.  通过 `legends.data` 属性，自定义显示顺序

另外也可以直接通过修改图例组件的顺序来达到目的，`legends.data` 是一个回调类型，会将图例的绘制顺序作为参数传递给用户，用户可以根据自己的需要进行顺序或者其他操作，但是需要注意返回的数据必须符合图例顺序的格式。

如果你只是简单想让图例顺序反转下，也可以直接开启 `legends.reverse` 属性即可。

![](/vchart/faq/89-2.png)

## 代码示例

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

## 相关文档

- [数据教程](https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Data/Data_Types_and_Interface)
- [数据配置](<https://www.visactor.io/vchart/option/barChart#data(IDataType%7CIDataType%5B%5D).IDataValues.id>)
- [图例教程](https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Legend)
- [图例配置](https://www.visactor.io/vchart/option/barChart#legends-discrete.type)
