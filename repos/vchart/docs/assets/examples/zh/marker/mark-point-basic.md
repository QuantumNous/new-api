---
category: examples
group: marker
title: markPoint 数据点定位
keywords: marker,lineChart
order: 33-8
cover: /vchart/preview/basic-mark-point-1.11.1.png
option: lineChart#markPoint
---

# markPoint 数据点定位

markArea 支持数据点 和 任意坐标定位方式, 此处展示数据点定位效果.

## 关键配置

数据点定位:

- `coordinate`属性声明为数据点或数据点聚合值, 数据点的声明方式为`{ xKey: value , yKey: value }`, 其中`xKey`为 x 轴对应的数据字段; `yKey`为 y 轴对应的数据字段; `value`为数据字段对应的数值 或 数据聚合类型, 聚合方式支持`"variance" | "average" | "min" | "max" | "sum" | "standardDeviation" | "median"`.

- `itemLine`属性声明为标注引导线
  - `itemLine.type`属性声明为引导线类型, 支持`"type-s" | "type-do" | "type-po" | "type-op" | "type-arc"`, `"type-s"`为起点和终点直接连线, `"type-do"`为表示包含一个折点，且折点 x 坐标为起点到终点的 1/2 x 坐标，折点 y 坐标为起点 y 坐标， `"type-po"`为表示包含一个折点，且折点 x 坐标为终点 x 坐标，折点 y 坐标为起点 y 坐标，`"type-op"`为表示包含一个折点，且折点 x 坐标为起点 x 坐标，折点 y 坐标为终点 y 坐标, `"type-arc"`表示圆弧。
  - `itemLine.arcRatio`属性声明为圆心到连线中点的偏移量，绝对值越小，圆弧曲率越小。
  - `itemLine.visible`属性声明为引导线的可见性
  - `itemLine.decorativeLine`属性声明为垂直于引导线的装饰线属性, 支持`visible`可见性和`length`长度配置.
  - `itemLine.startSymbol`属性声明为引导线起点的装饰图元样式
  - `itemLine.endSymbol`属性声明为引导线终点的装饰图元样式
- `itemContent`属性声明为标注内容
  - `itemContent.type` 属性声明为标注内容的类型, 支持`'symbol' | 'text' | 'image' | 'richText'`类型
  - `itemContent.offsetX`属性声明为标注内容与标注点的 x 方向偏移, 用于定位标注内容和绘制标注线.
  - `itemContent.offsetY`属性声明为标注内容与标注点的 y 方向偏移, 用于定位标注内容和绘制引导线.
  - `itemContent.autoRotate`属性声明为标注内容是否自动旋转至引导线平行的方向.
  - `itemContent.richText`属性声明为当`itemContent.type: richText`时, 标注内容的样式, 同理也可应用于其他标注内容类型.
- `targetSymbol`声明为前置标记，用于标记数据点，突出标记点。

## 代码演示

```javascript livedemo
const spec = {
  type: 'line',
  xField: 'year',
  yField: 'population',
  axes: [
    {
      orient: 'bottom',
      type: 'linear',
      min: 1868,
      max: 2016
    }
  ],
  markPoint: [
    {
      coordinate: {
        year: '1878',
        population: 100
      },
      itemContent: {
        offsetY: -100,
        offsetX: 100,
        type: 'text',
        autoRotate: false,
        confine: true,
        style: {
          text: '1878 population was 148'
        }
      },
      targetSymbol: {
        visible: true
      },
      itemLine: {
        type: 'type-arc',
        arcRatio: 0.4,
        startSymbol: {
          size: 10,
          style: {
            stroke: '#E8346D',
            symbolType: 'triangle'
          }
        },
        line: {
          style: {
            stroke: '#E8346D'
          }
        }
      }
    },
    {
      coordinate: {
        year: '2016',
        population: 899447
      },
      itemContent: {
        offsetY: 40,
        // offsetX: -200,
        type: 'richText',
        autoRotate: false,
        confine: true,
        position: 'insideBottom',

        style: {
          width: 100,
          height: 50,
          dx: 110,
          dy: 10,
          textConfig: [
            {
              text: '2016\n',
              fontWeight: 'bold',
              fontSize: 13,
              fill: '#E8346D',
              fontFamily: 'Times New Roman'
            },
            {
              text: 'population was 899447',
              fontSize: 10,
              fill: '#E8346D',
              fontFamily: 'Times New Roman'
            }
          ]
        }
      },
      itemLine: {
        type: 'type-do',
        startSymbol: {
          size: 24,
          style: {
            stroke: '#E8346D'
          }
        },
        line: {
          style: {
            stroke: '#E8346D'
          }
        }
      }
    }
  ],
  point: {
    style: {
      visible: false
    }
  },
  line: {
    style: {
      lineWidth: 2
    }
  },
  title: {
    text: 'Population History - Line Chart',
    textStyle: {
      lineWidth: 3,
      fill: '#333',
      fontSize: 20,
      fontFamily: 'Times New Roman'
    }
  },
  data: {
    id: 'data2',
    values: [
      {
        census_year: true,
        year: 2016,
        source: 'CoE',
        population: 899447
      },
      {
        census_year: true,
        year: 2014,
        source: 'CoE',
        population: 877926
      },
      {
        year: 2013,
        source: 'CoE 6',
        population: 847712
      },
      {
        census_year: true,
        year: 2012,
        source: 'CoE',
        population: 817498
      },
      {
        year: 2010,
        source: 'CoE 6',
        population: 797320
      },
      {
        census_year: true,
        year: 2009,
        source: 'CoE',
        population: 782439
      },
      {
        census_year: true,
        year: 2008,
        source: 'CoE',
        population: 752412
      },
      {
        year: 2007,
        source: 'CoE 6',
        population: 741392
      },
      {
        census_year: true,
        year: 2005,
        source: 'CoE',
        population: 712391
      },
      {
        year: 2004,
        source: 'CoE 6',
        population: 698631
      },
      {
        year: 2003,
        source: 'CoE 6',
        population: 684871
      },
      {
        year: 2002,
        source: 'CoE 6',
        population: 671110
      },
      {
        year: 2000,
        source: 'CoE 6',
        population: 652817
      },
      {
        census_year: true,
        year: 1999,
        source: 'CoE',
        population: 648284
      },
      {
        year: 1998,
        source: 'CoE 6',
        population: 637625
      },
      {
        year: 1997,
        source: 'CoE 6',
        population: 626965
      },
      {
        year: 1995,
        source: 'CoE 6',
        population: 619870
      },
      {
        year: 1994,
        source: 'CoE 6',
        population: 623435
      },
      {
        census_year: true,
        year: 1993,
        source: 'CoE',
        population: 626999
      },
      {
        census_year: true,
        year: 1992,
        source: 'CoE',
        population: 618195
      },
      {
        census_year: true,
        year: 1990,
        source: 'CoE',
        population: 605538
      },
      {
        census_year: true,
        year: 1989,
        source: 'CoE',
        population: 583872
      },
      {
        year: 1988,
        source: 'CoE',
        population: 580061
      },
      {
        census_year: true,
        year: 1987,
        source: 'CoE',
        population: 576249
      },
      {
        year: 1985,
        source: 'CoE 6',
        population: 567699
      },
      {
        year: 1984,
        source: 'CoE 6',
        population: 563892
      },
      {
        census_year: true,
        year: 1983,
        source: 'CoE',
        population: 560085
      },
      {
        census_year: true,
        year: 1982,
        source: 'CoE 1',
        population: 551314
      },
      {
        census_year: true,
        year: 1980,
        source: 'CoE',
        population: 505773
      },
      {
        census_year: true,
        year: 1979,
        source: 'CoE',
        population: 491359
      },
      {
        census_year: true,
        year: 1978,
        source: 'CoE',
        population: 478066
      },
      {
        census_year: true,
        year: 1977,
        source: 'CoE',
        population: 471474
      },
      {
        census_year: true,
        year: 1975,
        source: 'CoE',
        population: 451635
      },
      {
        census_year: true,
        year: 1974,
        source: 'CoE',
        population: 445691
      },
      {
        census_year: true,
        year: 1973,
        source: 'CoE',
        population: 442365
      },
      {
        census_year: true,
        year: 1972,
        source: 'CoE',
        population: 441530
      },
      {
        census_year: true,
        year: 1970,
        source: 'CoE',
        population: 429750
      },
      {
        census_year: true,
        year: 1969,
        source: 'CoE',
        population: 422418
      },
      {
        census_year: true,
        year: 1968,
        source: 'CoE',
        population: 410105
      },
      {
        census_year: true,
        year: 1967,
        source: 'CoE',
        population: 393593
      },
      {
        census_year: true,
        year: 1965,
        source: 'CoE',
        population: 371265
      },
      {
        census_year: true,
        year: 1964,
        source: 'CoE 2',
        population: 311804
      },
      {
        census_year: true,
        year: 1963,
        source: 'CoE',
        population: 303756
      },
      {
        census_year: true,
        year: 1962,
        source: 'CoE',
        population: 294967
      },
      {
        census_year: true,
        year: 1960,
        source: 'CoE',
        population: 269314
      },
      {
        census_year: true,
        year: 1959,
        source: 'CoE',
        population: 260733
      },
      {
        census_year: true,
        year: 1958,
        source: 'CoE',
        population: 252131
      },
      {
        census_year: true,
        year: 1957,
        source: 'CoE',
        population: 238353
      },
      {
        census_year: true,
        year: 1955,
        source: 'CoE',
        population: 209353
      },
      {
        census_year: true,
        year: 1954,
        source: 'CoE',
        population: 197836
      },
      {
        census_year: true,
        year: 1953,
        source: 'CoE',
        population: 183411
      },
      {
        census_year: true,
        year: 1952,
        source: 'CoE',
        population: 169196
      },
      {
        census_year: true,
        year: 1950,
        source: 'CoE',
        population: 148861
      },
      {
        census_year: true,
        year: 1949,
        source: 'CoE',
        population: 137469
      },
      {
        census_year: true,
        year: 1948,
        source: 'CoE',
        population: 126609
      },
      {
        census_year: true,
        year: 1947,
        source: 'CoE',
        population: 118541
      },
      {
        census_year: true,
        year: 1946,
        source: 'CoE',
        population: 114976
      },
      {
        census_year: true,
        year: 1945,
        source: 'CoE',
        population: 111745
      },
      {
        census_year: true,
        year: 1944,
        source: 'CoE',
        population: 108416
      },
      {
        census_year: true,
        year: 1943,
        source: 'CoE',
        population: 105536
      },
      {
        census_year: true,
        year: 1942,
        source: 'CoE',
        population: 96725
      },
      {
        census_year: true,
        year: 1940,
        source: 'CoE',
        population: 91723
      },
      {
        census_year: true,
        year: 1939,
        source: 'CoE',
        population: 90419
      },
      {
        census_year: true,
        year: 1938,
        source: 'CoE',
        population: 88887
      },
      {
        census_year: true,
        year: 1937,
        source: 'CoE',
        population: 87034
      },
      {
        census_year: true,
        year: 1936,
        source: 'CoE',
        population: 85470
      },
      {
        census_year: true,
        year: 1935,
        source: 'CoE',
        population: 82634
      },
      {
        census_year: true,
        year: 1934,
        source: 'CoE',
        population: 79773
      },
      {
        census_year: true,
        year: 1933,
        source: 'CoE',
        population: 79231
      },
      {
        census_year: true,
        year: 1932,
        source: 'CoE',
        population: 78387
      },
      {
        census_year: true,
        year: 1930,
        source: 'CoE',
        population: 77557
      },
      {
        census_year: true,
        year: 1929,
        source: 'CoE',
        population: 74298
      },
      {
        census_year: true,
        year: 1928,
        source: 'CoE',
        population: 69744
      },
      {
        census_year: true,
        year: 1927,
        source: 'CoE',
        population: 67083
      },
      {
        census_year: true,
        year: 1926,
        source: 'CoE',
        population: 65163
      },
      {
        census_year: true,
        year: 1925,
        source: 'CoE',
        population: 65378
      },
      {
        census_year: true,
        year: 1924,
        source: 'CoE',
        population: 63160
      },
      {
        census_year: true,
        year: 1923,
        source: 'CoE*',
        population: 60000
      },
      {
        census_year: true,
        year: 1922,
        source: 'CoE*',
        population: 60000
      },
      {
        census_year: true,
        year: 1920,
        source: 'CoE',
        population: 61045
      },
      {
        census_year: true,
        year: 1919,
        source: 'CoE*',
        population: 60000
      },
      {
        census_year: true,
        year: 1918,
        source: 'CoE*',
        population: 53000
      },
      {
        census_year: true,
        year: 1917,
        source: 'CoE* 4',
        population: 51000
      },
      {
        census_year: true,
        year: 1916,
        source: 'CoE',
        population: 53846
      },
      {
        census_year: true,
        year: 1915,
        source: 'CoE',
        population: 59339
      },
      {
        census_year: true,
        year: 1914,
        source: 'CoE',
        population: 72516
      },
      {
        census_year: true,
        year: 1913,
        source: 'CoE',
        population: 67243
      },
      {
        census_year: true,
        year: 1912,
        source: 'CoE 5',
        population: 53611
      },
      {
        year: 1910,
        source: 'CoE 6',
        population: 23950
      },
      {
        census_year: true,
        year: 1909,
        source: 'CoE*',
        population: 23000
      },
      {
        census_year: true,
        year: 1908,
        source: 'CoE',
        population: 18500
      },
      {
        year: 1907,
        source: 'CoE 6',
        population: 16294
      },
      {
        census_year: true,
        year: 1906,
        source: 'CoE',
        population: 14088
      },
      {
        year: 1905,
        source: 'CoE 6',
        population: 11219
      },
      {
        census_year: true,
        year: 1904,
        source: 'CoE',
        population: 8350
      },
      {
        census_year: true,
        year: 1903,
        source: 'CoE',
        population: 6995
      },
      {
        year: 1902,
        source: 'CoE 6',
        population: 4811
      },
      {
        year: 1900,
        source: 'CoE 6',
        population: 2419
      },
      {
        census_year: true,
        year: 1899,
        source: 'CoE',
        population: 2212
      },
      {
        year: 1898,
        source: 'CoE 6',
        population: 2212
      },
      {
        census_year: true,
        year: 1897,
        source: 'CoE',
        population: 2212
      },
      {
        year: 1896,
        source: 'CoE 6',
        population: 1689
      },
      {
        census_year: true,
        year: 1895,
        source: 'CoE',
        population: 1165
      },
      {
        year: 1894,
        source: 'CoE 6',
        population: 1010
      },
      {
        year: 1893,
        source: 'CoE 6',
        population: 855
      },
      {
        census_year: true,
        year: 1892,
        source: 'CoE',
        population: 700
      },
      {
        year: 1891,
        source: 'CoE 6',
        population: 630
      },
      {
        year: 1890,
        source: 'CoE 6',
        population: 560
      },
      {
        year: 1889,
        source: 'CoE 6',
        population: 490
      },
      {
        year: 1888,
        source: 'CoE 6',
        population: 420
      },
      {
        census_year: true,
        year: 1887,
        source: 'CoE*',
        population: 350
      },
      {
        year: 1886,
        source: 'CoE',
        population: 307
      },
      {
        census_year: true,
        year: 1885,
        source: 'CoE',
        population: 263
      },
      {
        year: 1884,
        source: 'CoE 6',
        population: 247
      },
      {
        year: 1883,
        source: 'CoE 6',
        population: 230
      },
      {
        year: 1882,
        source: 'CoE 6',
        population: 214
      },
      {
        year: 1881,
        source: 'CoE 6',
        population: 197
      },
      {
        year: 1880,
        source: 'CoE 6',
        population: 181
      },
      {
        year: 1879,
        source: 'CoE 6',
        population: 164
      },
      {
        census_year: true,
        year: 1878,
        source: 'CoE',
        population: 148
      }
    ].reverse()
  }
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[scrollBar](link)
