import { isMobile } from 'react-device-detect';
import { default as VChart } from '../../../../src/index';
import { DataSet, DataView, csvParser } from '@visactor/vdataset';

const run = () => {
  const dataSet = new DataSet();
  dataSet.registerParser('csv', csvParser);
  const dataView = new DataView(dataSet);
  const type1 = ['A', 'B'];
  const type2 = ['A', 'B'];
  const color = {
    A: {
      A: 'A',
      B: 'B'
    },
    B: {
      A: 'C',
      B: 'D'
    }
  };

  let data = 'y,x,y2,type,type2,color';
  type2.forEach(t2 => {
    type1.forEach(t => {
      for (let i = 0; i < 10; i++) {
        data += `\n${Math.floor(Math.random() * 300) + 600},${i},0,${t},${t2},${color[t][t2]}`;
      }
    });
  });

  dataView.parse(data, {
    type: 'csv'
  });
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
          autoRotate: false,
          textStyle: {
            type: 'rich',
            text: [
              {
                text: 'RICHTEXT',
                fontWeight: 'bold',
                fontSize: 25,
                fill: '#3f51b5'
              },
              {
                text: '替代方案',
                fontStyle: 'italic',
                textDecoration: 'underline',
                fill: '#3f51b5'
              }
            ]
          }
        },
        itemLine: {
          // startSymbol: {
          //   visible: false
          // },
          decorativeLine: {
            visible: true
          },
          startSymbol: {
            size: 20,
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
      },
      {
        coordinate: {
          year: '2016',
          population: 899447
        },
        itemContent: {
          offsetY: 40,
          offsetX: -200,
          type: 'richText',
          autoRotate: false,
          position: 'insideBottom',
          richText: {
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

  const spec_markLine = {
    type: 'scatter',
    padding: [12, 20, 12, 12],
    xField: 'x',
    yField: 'y',
    sizeField: 'z',
    size: {
      type: 'linear',
      range: [20, 80]
    },
    axes: [
      { orient: 'bottom', type: 'linear', min: 60, max: 95 },
      { orient: 'left', type: 'linear', min: 0, max: 200 }
    ],
    point: {
      style: {
        fillOpacity: 0.25,
        lineWidth: 1,
        stroke: '#6690F2',
        fill: '#6690F2'
      }
    },
    label: {
      visible: true,
      position: 'center',
      overlap: {
        avoidBaseMark: false
      },
      style: {
        stroke: '#fff',
        lineWidth: 1
      }
    },
    markLine: [
      {
        x: 65,
        label: {
          visible: true,
          position: 'end',
          //   text: 'Safe fat intake 65g/day',
          type: 'rich',
          text: [
            {
              text: 'RICHTEXT',
              fontWeight: 'bold',
              fontSize: 25,
              fill: '#3f51b5'
            },
            {
              text: '替代方案',
              fontStyle: 'italic',
              textDecoration: 'underline',
              fill: '#3f51b5'
            }
          ],
          style: {
            textAlign: 'left',
            textBaseline: 'top',
            fill: '#000',
            dx: 10
          },
          labelBackground: {
            visible: false
          }
        },
        line: {
          style: {
            stroke: '#000',
            lineDash: [0]
          }
        }
      },
      {
        y: 50,
        label: {
          visible: true,
          position: 'end',
          text: 'Safe sugar intake 50g/day',
          style: {
            textAlign: 'right',
            textBaseline: 'bottom',
            fill: '#000'
          },
          labelBackground: {
            visible: false
          }
        },
        line: {
          style: {
            stroke: '#000',
            lineDash: [0]
          }
        }
      }
    ],
    tooltip: {
      mark: {
        title: {
          value: datum => datum.country
        }
      }
    },
    data: {
      id: 'data',
      values: [
        { x: 95, y: 95, z: 13.8, name: 'BE', country: 'Belgium' },
        { x: 86.5, y: 102.9, z: 14.7, name: 'DE', country: 'Germany' },
        { x: 80.8, y: 91.5, z: 15.8, name: 'FI', country: 'Finland' },
        { x: 80.4, y: 102.5, z: 12, name: 'NL', country: 'Netherlands' },
        { x: 80.3, y: 86.1, z: 11.8, name: 'SE', country: 'Sweden' },
        { x: 78.4, y: 70.1, z: 16.6, name: 'ES', country: 'Spain' },
        { x: 74.2, y: 68.5, z: 14.5, name: 'FR', country: 'France' },
        { x: 73.5, y: 83.1, z: 10, name: 'NO', country: 'Norway' },
        { x: 71, y: 93.2, z: 24.7, name: 'UK', country: 'United Kingdom' },
        { x: 69.2, y: 57.6, z: 10.4, name: 'IT', country: 'Italy' },
        { x: 68.6, y: 20, z: 16, name: 'RU', country: 'Russia' },
        { x: 65.5, y: 126.4, z: 35.3, name: 'US', country: 'United States' },
        { x: 65.4, y: 50.8, z: 28.5, name: 'HU', country: 'Hungary' },
        { x: 63.4, y: 51.8, z: 15.4, name: 'PT', country: 'Portugal' },
        { x: 64, y: 82.9, z: 31.3, name: 'NZ', country: 'New Zealand' }
      ]
    }
  };

  const spec_markArea = {
    type: 'line',
    xField: 'Date',
    yField: 'Price',
    point: {
      visible: false // disable point
    },
    line: {
      style: {
        lineWidth: 3,
        lineCap: 'round'
      }
    },
    axes: [
      {
        orient: 'left',
        min: 0.12,
        max: 0.18,
        tick: {
          visible: false
        },
        grid: {
          style: {
            lineDash: [0, 0]
          }
        },
        domainLine: {
          visible: false
        },
        label: {
          // format tick label, the last label add unit
          formatMethod: (value, datum) => {
            if (value === 0.18) {
              return `$${value}`;
            }
            return value;
          }
        }
      }, // configure y-axis 配置 y 轴
      {
        orient: 'bottom',
        label: {
          formatMethod: (value, datum) => {
            if (value.startsWith('Jan-')) {
              return `20${value.split('-')[1]}`;
            }

            return '';
          }
        }
      }
    ],
    markArea: [
      {
        coordinates: [
          {
            Date: 'Jan-20',
            Price: 0.18
          },
          {
            Date: 'Mar-23',
            Price: 0.18
          },
          {
            Date: 'Mar-23',
            Price: 0.12
          },
          {
            Date: 'Jan-20',
            Price: 0.12
          }
        ],
        label: {
          //   text: 'Electricite prices have surged since 2020',
          type: 'rich',
          text: [
            {
              text: 'RICHTEXT',
              fontWeight: 'bold',
              fontSize: 25,
              fill: '#3f51b5'
            },
            {
              text: '替代方案',
              fontStyle: 'italic',
              textDecoration: 'underline',
              fill: '#3f51b5'
            }
          ],
          position: 'insideTop'
        }
      }
    ],
    data: {
      id: 'data',
      values: [
        { Date: 'Jan-13', Price: 0.129 },
        { Date: 'Feb-13', Price: 0.129 },
        { Date: 'Mar-13', Price: 0.128 },
        { Date: 'Apr-13', Price: 0.128 },
        { Date: 'May-13', Price: 0.131 },
        { Date: 'Jun-13', Price: 0.137 },
        { Date: 'Jul-13', Price: 0.137 },
        { Date: 'Aug-13', Price: 0.137 },
        { Date: 'Sep-13', Price: 0.137 },
        { Date: 'Oct-13', Price: 0.132 },
        { Date: 'Nov-13', Price: 0.13 },
        { Date: 'Dec-13', Price: 0.131 },
        { Date: 'Jan-14', Price: 0.134 },
        { Date: 'Feb-14', Price: 0.134 },
        { Date: 'Mar-14', Price: 0.135 },
        { Date: 'Apr-14', Price: 0.131 },
        { Date: 'May-14', Price: 0.136 },
        { Date: 'Jun-14', Price: 0.143 },
        { Date: 'Jul-14', Price: 0.143 },
        { Date: 'Aug-14', Price: 0.143 },
        { Date: 'Sep-14', Price: 0.141 },
        { Date: 'Oct-14', Price: 0.136 },
        { Date: 'Nov-14', Price: 0.134 },
        { Date: 'Dec-14', Price: 0.135 },
        { Date: 'Jan-15', Price: 0.138 },
        { Date: 'Feb-15', Price: 0.138 },
        { Date: 'Mar-15', Price: 0.136 },
        { Date: 'Apr-15', Price: 0.137 },
        { Date: 'May-15', Price: 0.137 },
        { Date: 'Jun-15', Price: 0.143 },
        { Date: 'Jul-15', Price: 0.142 },
        { Date: 'Aug-15', Price: 0.142 },
        { Date: 'Sep-15', Price: 0.141 },
        { Date: 'Oct-15', Price: 0.136 },
        { Date: 'Nov-15', Price: 0.134 },
        { Date: 'Dec-15', Price: 0.133 },
        { Date: 'Jan-16', Price: 0.134 },
        { Date: 'Feb-16', Price: 0.134 },
        { Date: 'Mar-16', Price: 0.134 },
        { Date: 'Apr-16', Price: 0.134 },
        { Date: 'May-16', Price: 0.133 },
        { Date: 'Jun-16', Price: 0.138 },
        { Date: 'Jul-16', Price: 0.139 },
        { Date: 'Aug-16', Price: 0.139 },
        { Date: 'Sep-16', Price: 0.139 },
        { Date: 'Oct-16', Price: 0.134 },
        { Date: 'Nov-16', Price: 0.131 },
        { Date: 'Dec-16', Price: 0.133 },
        { Date: 'Jan-17', Price: 0.134 },
        { Date: 'Feb-17', Price: 0.135 },
        { Date: 'Mar-17', Price: 0.134 },
        { Date: 'Apr-17', Price: 0.135 },
        { Date: 'May-17', Price: 0.137 },
        { Date: 'Jun-17', Price: 0.142 },
        { Date: 'Jul-17', Price: 0.143 },
        { Date: 'Aug-17', Price: 0.142 },
        { Date: 'Sep-17', Price: 0.142 },
        { Date: 'Oct-17', Price: 0.137 },
        { Date: 'Nov-17', Price: 0.136 },
        { Date: 'Dec-17', Price: 0.136 },
        { Date: 'Jan-18', Price: 0.135 },
        { Date: 'Feb-18', Price: 0.135 },
        { Date: 'Mar-18', Price: 0.135 },
        { Date: 'Apr-18', Price: 0.134 },
        { Date: 'May-18', Price: 0.136 },
        { Date: 'Jun-18', Price: 0.139 },
        { Date: 'Jul-18', Price: 0.139 },
        { Date: 'Aug-18', Price: 0.139 },
        { Date: 'Sep-18', Price: 0.138 },
        { Date: 'Oct-18', Price: 0.136 },
        { Date: 'Nov-18', Price: 0.134 },
        { Date: 'Dec-18', Price: 0.135 },
        { Date: 'Jan-19', Price: 0.135 },
        { Date: 'Feb-19', Price: 0.136 },
        { Date: 'Mar-19', Price: 0.135 },
        { Date: 'Apr-19', Price: 0.135 },
        { Date: 'May-19', Price: 0.136 },
        { Date: 'Jun-19', Price: 0.139 },
        { Date: 'Jul-19', Price: 0.14 },
        { Date: 'Aug-19', Price: 0.139 },
        { Date: 'Sep-19', Price: 0.139 },
        { Date: 'Oct-19', Price: 0.136 },
        { Date: 'Nov-19', Price: 0.133 },
        { Date: 'Dec-19', Price: 0.133 },
        { Date: 'Jan-20', Price: 0.134 },
        { Date: 'Feb-20', Price: 0.134 },
        { Date: 'Mar-20', Price: 0.134 },
        { Date: 'Apr-20', Price: 0.133 },
        { Date: 'May-20', Price: 0.134 },
        { Date: 'Jun-20', Price: 0.137 },
        { Date: 'Jul-20', Price: 0.137 },
        { Date: 'Aug-20', Price: 0.137 },
        { Date: 'Sep-20', Price: 0.137 },
        { Date: 'Oct-20', Price: 0.135 },
        { Date: 'Nov-20', Price: 0.136 },
        { Date: 'Dec-20', Price: 0.136 },
        { Date: 'Jan-21', Price: 0.136 },
        { Date: 'Feb-21', Price: 0.137 },
        { Date: 'Mar-21', Price: 0.138 },
        { Date: 'Apr-21', Price: 0.139 },
        { Date: 'May-21', Price: 0.14 },
        { Date: 'Jun-21', Price: 0.142 },
        { Date: 'Jul-21', Price: 0.143 },
        { Date: 'Aug-21', Price: 0.144 },
        { Date: 'Sep-21', Price: 0.144 },
        { Date: 'Oct-21', Price: 0.142 },
        { Date: 'Nov-21', Price: 0.142 },
        { Date: 'Dec-21', Price: 0.142 },
        { Date: 'Jan-22', Price: 0.147 },
        { Date: 'Feb-22', Price: 0.148 },
        { Date: 'Mar-22', Price: 0.15 },
        { Date: 'Apr-22', Price: 0.151 },
        { Date: 'May-22', Price: 0.154 },
        { Date: 'Jun-22', Price: 0.16 },
        { Date: 'Jul-22', Price: 0.164 },
        { Date: 'Aug-22', Price: 0.167 },
        { Date: 'Sep-22', Price: 0.167 },
        { Date: 'Oct-22', Price: 0.166 },
        { Date: 'Nov-22', Price: 0.163 },
        { Date: 'Dec-22', Price: 0.165 },
        { Date: 'Jan-23', Price: 0.168 },
        { Date: 'Feb-23', Price: 0.168 },
        { Date: 'Mar-23', Price: 0.166 }
      ]
    }
  };

  const cs = new VChart(spec, {
    dataSet,
    dom: document.getElementById('chart') as HTMLElement,
    mode: isMobile ? 'mobile-browser' : 'desktop-browser'
  });
  console.time('renderTime');
  cs.renderAsync().then(() => {
    console.timeEnd('renderTime');
  });
  window['vchart'] = cs;
  console.log(cs);
};
run();
