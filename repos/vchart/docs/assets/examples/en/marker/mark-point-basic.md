---
category: examples
group: marker
title: markPoint Data Point Positioning
keywords: marker, lineChart
order: 33-8
cover: /vchart/preview/basic-mark-point-1.11.1.png
option: lineChart#markPoint
---

# markPoint Data Point Positioning

markArea supports data point and arbitrary coordinate positioning methods, and this demonstrates the data point positioning effect.

## Key option

Data point positioning:

- The `coordinate` attribute is declared as a data point or aggregate value of data points. The declaration of the data point is `{xKey: value, yKey: value}`, where `xKey` is the data field corresponding to the x-axis; `yKey` is the data field corresponding to the y-axis; `value` is the numerical value corresponding to the data field or data aggregation type. The aggregation method supports `"variance" | "average" | "min" | "max" | "sum" | "standardDeviation" | "median"`.

- The `itemLine` attribute is declared as the annotation guide line.
  - The `itemLine.type` attribute is declared as the type of guide line, supporting `"type-s" | "type-do" | "type-po" | "type-op"`. `"type-s"` is the direct line between the start and end points, `"type-do"` indicates that there is a breakpoint, and the breakpoint x-coordinate is 1/2 x-coordinate from the starting point to the end point, the breakpoint y-coordinate is the starting point y-coordinate, `"type-po"` indicates that there is a breakpoint, and the breakpoint x-coordinate is the end point x-coordinate, the breakpoint y-coordinate is the start point y-coordinate, `"type-op"` indicates that there is a breakpoint, and the breakpoint x-coordinate is the starting point x-coordinate, the breakpoint y-coordinate is the end point y-coordinate,`"type-arc"` means arc.
  - The `itemLine.arcRatio` property is declared as the offset from the center of the circle to the midpoint of the connection line. The smaller the absolute value, the smaller the arc curvature.
  - The `itemLine.visible` attribute declares the visibility of the guide line.
  - The `itemLine.decorativeLine` attribute declares the decorative line attribute perpendicular to the guide line, supporting `visible` visibility and `length` length configuration.
  - The `itemLine.startSymbol` attribute declares the decorative primitive style for the starting point of the guide line.
  - The `itemLine.endSymbol` attribute declares the decorative primitive style for the end point of the guide line.
- The `itemContent` attribute is declared as the annotation content.
  - The `itemContent.type` attribute declares the type of annotation content, supporting `'symbol' | 'text' | 'image' | 'richText'` types.
  - The `itemContent.offsetX` attribute declares the x-direction offset of the annotation content from the annotation point, used for positioning the annotation content and drawing the annotation line.
  - The `itemContent.offsetY` attribute declares the y-direction offset of the annotation content from the annotation point, used for positioning the annotation content and drawing the guide line.
  - The `itemContent.autoRotate` attribute declares whether the annotation content automatically rotates to the direction parallel to the guide line.
  - The `itemContent.richText` attribute declares the annotation content style when `itemContent.type: richText`, and can also be applied to other annotation content types.
- `targetSymbol` is declared as a prefix mark, used to mark data points and highlight mark points.

## Demo source

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

## Related Tutorials

[scrollBar](link)
