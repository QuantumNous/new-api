# Pie / Ring Chart

[\[Configuration Manual\]](../../../option/pieChart)

## Introduction

Pie chart, also known as a pie chart, is a circular statistical chart divided into several sectors to describe the relative relationship between quantities, frequencies or percentages. In a pie chart, the size of the arc length (as well as the central angle and area) of each sector represents the proportion of the quantity it represents. These sectors together form a complete circle.

A donut chart is formed by adding the `innerRadius` and `outerRadius` attributes to the base of the pie chart to adjust the inner and outer radii of the specified sectors.

In VChart, you can display the relative relationships of multiple data through the [Pie/Donut Chart Configuration](../../../option/pieChart). The following chart shows the distribution of the U.S. population by age in 2021 using a combination of a pie chart and donut chart:
![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/45df54929d214e7453e228f2b.png)
In the [Nested Pie Chart Example](../../../demo/pie-chart/nested-pie) shown above, you need the following key configurations:

- The `categoryField` and `valueField` attributes are used to specify the pie chart category and sector angle fields, respectively
- The `innerRadius` and `outerRadius` attributes are used to specify the inner and outer radii of the sector.

## Chart composition

Pie charts are made up of sector primitives, labels, and legends, among other components.

![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/350c0511133d336e622523220.png)

Sector primitives are the basic elements of pie/donut charts, and related drawing configurations are essential:

- `pieChart.type`: chart type, pie/donut chart type is `'pie'`
- `pieChart.data`: data source for chart drawing
- `pieChart.categoryField`: category field, mapping the sector category of the graphic element
- `pieChart.valueField`: value field, mapping the sector angle of the graphic element
- `pieChart.seriesField`: category field, mapping the sector color of the graphic element

Indicator cards, tooltips, and other components that assist the chart in displaying are optional configurations with default effects and functionality:

- `pieChart.indicator`: Indicator card component, located at the heart of the pie chart, used to display total data or the data of a specific sector during interaction. See the detailed configuration of [VChart Indicator Card Component Configuration](../../../option/pieChart#indicator)
- `pieChart.tooltip`: Tooltip information, displayed by default during interaction. See the detailed configuration of [VChart Tooltip Component Configuration](../../../option/pieChart#tooltip)
- For more component configurations, see [VChart pieChart Configuration](../../../option/pieChart)

## Quick Start

```javascript livedemo
const spec = {
  type: 'pie',
  data: [
    {
      id: 'id0',
      values: [
        { type: 'oxygen', value: '46.60' },
        { type: 'silicon', value: '27.72' },
        { type: 'aluminum', value: '8.13' },
        { type: 'iron', value: '5' },
        { type: 'calcium', value: '3.63' },
        { type: 'sodium', value: '2.83' },
        { type: 'potassium', value: '2.59' },
        { type: 'others', value: '3.5' }
      ]
    }
  ],
  outerRadius: 0.8,
  valueField: 'value',
  categoryField: 'type',
  title: {
    visible: true,
    text: 'Surface element content statistics'
  },
  legends: {
    visible: true,
    orient: 'left'
  },
  label: {
    visible: true
  },
  tooltip: {
    mark: {
      content: [
        {
          key: datum => datum['type'],
          value: datum => datum['value'] + '%'
        }
      ]
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

### Key Configuration

- The `categoryField` attribute is used to specify the pie chart category field
- The `valueField` attribute is used to specify the sector angle field

## Pie/Donut Chart Features

### Data

- One `discrete` field, such as: `product`
- One `numerical` field, such as: `sales`

A dataset of product categories and sales is defined as follows:

```ts
data: [
  {
    name: 'bar',
    values: [
      {
        product: 'Digital Products',
        sales: 20
      },
      {
        product: 'Daily Necessities',
        sales: 50
      },
      {
        product: 'Food',
        sales: 80
      }
    ]
  }
];
```

### Pie Chart Labels

Since there is no explicit axis, pie charts often rely on label components to display the different data categories represented by different sectors. Pie chart labels are usually made up of guide lines and label content. To avoid label overlap, VChart provides an excellent adaptive layout solution.

```javascript livedemo
const spec = {
  type: 'pie',
  valueField: 'y',
  categoryField: 'originXData',
  label: {
    visible: true,
    position: 'outside'
  },
  legends: {
    orient: 'right'
  },
  title: {
    visible: true,
    text: 'Distribution of Active Device Usage Time',
    textStyle: {
      fontFamily: 'Times New Roman'
    }
  },
  data: {
    id: 'Others',
    values: [
      {
        x: 0,
        y: 0.14307327905613595,
        originXData: '2022-03-10',
        type: 'Others'
      },
      {
        x: 1,
        y: 0.21429552139096195,
        originXData: '2022-03-11',
        type: 'Others'
      },
      {
        x: 2,
        y: 0.20335734294489136,
        originXData: '2022-03-12',
        type: 'Others'
      },
      {
        x: 3,
        y: 0.2008694831063025,
        originXData: '2022-03-13',
        type: 'Others'
      },
      {
        x: 4,
        y: 0.1971832522288174,
        originXData: '2022-03-14',
        type: 'Others'
      },
      {
        x: 5,
        y: 0.2142196933878632,
        originXData: '2022-03-15',
        type: 'Others'
      },
      {
        x: 6,
        y: 0.2827589869448442,
        originXData: '2022-03-16',
        type: 'Others'
      },
      {
        x: 7,
        y: 0.11448070987270477,
        originXData: '2022-03-17',
        type: 'Others'
      },
      {
        x: 8,
        y: 0.05225580072971028,
        originXData: '2022-03-18',
        type: 'Others'
      },
      {
        x: 9,
        y: 0.14047231243026995,
        originXData: '2022-03-19',
        type: 'Others'
      },
      {
        x: 10,
        y: 0.28277882018816153,
        originXData: '2022-03-20',
        type: 'Others'
      },
      {
        x: 11,
        y: 0.1907366902350664,
        originXData: '2022-03-21',
        type: 'Others'
      },
      {
        x: 12,
        y: 0.09187776153132483,
        originXData: '2022-03-22',
        type: 'Others'
      },
      {
        x: 13,
        y: 0.1865056149692558,
        originXData: '2022-03-23',
        type: 'Others'
      },
      {
        x: 14,
        y: 0.24279307316823684,
        originXData: '2022-03-24',
        type: 'Others'
      },
      {
        x: 15,
        y: 0.021338783251485593,
        originXData: '2022-03-25',
        type: 'Others'
      },
      {
        x: 16,
        y: 0.01933475918339416,
        originXData: '2022-03-26',
        type: 'Others'
      },
      {
        x: 17,
        y: 0.12054221495926994,
        originXData: '2022-03-27',
        type: 'Others'
      },
      {
        x: 18,
        y: 0.21045103303733279,
        originXData: '2022-03-28',
        type: 'Others'
      },
      {
        x: 19,
        y: 0.09510339439959557,
        originXData: '2022-03-29',
        type: 'Others'
      },
      {
        x: 20,
        y: 0.10953268445458815,
        originXData: '2022-03-30',
        type: 'Others'
      },
      {
        x: 21,
        y: 0.033257671235135976,
        originXData: '2022-03-31',
        type: 'Others'
      },
      {
        x: 22,
        y: 0.17596385420505348,
        originXData: '2022-04-01',
        type: 'Others'
      },
      {
        x: 23,
        y: 0.21956883545536887,
        originXData: '2022-04-02',
        type: 'Others'
      },
      {
        x: 24,
        y: 0.10219962878682523,
        originXData: '2022-04-03',
        type: 'Others'
      },
      {
        x: 25,
        y: 0.22559599632037952,
        originXData: '2022-04-04',
        type: 'Others'
      },
      {
        x: 26,
        y: 0.16435385997820343,
        originXData: '2022-04-05',
        type: 'Others'
      },
      {
        x: 27,
        y: 0.1935519088636391,
        originXData: '2022-04-06',
        type: 'Others'
      },
      {
        x: 28,
        y: 0.07335880623323374,
        originXData: '2022-04-07',
        type: 'Others'
      },
      {
        x: 29,
        y: 0.32389684991741824,
        originXData: '2022-04-08',
        type: 'Others'
      },
      {
        x: 30,
        y: 0.10574926398978153,
        originXData: '2022-04-09',
        type: 'Others'
      },
      {
        x: 31,
        y: 0.09551619886403787,
        originXData: '2022-04-10',
        type: 'Others'
      },
      {
        x: 32,
        y: 0.18753913754340706,
        originXData: '2022-04-11',
        type: 'Others'
      },
      {
        x: 33,
        y: 0.07251128093720469,
        originXData: '2022-04-12',
        type: 'Others'
      },
      {
        x: 34,
        y: 0.27187881356101434,
        originXData: '2022-04-13',
        type: 'Others'
      },
      {
        x: 35,
        y: 0.03161092640346868,
        originXData: '2022-04-14',
        type: 'Others'
      },
      {
        x: 36,
        y: 0.08645234316145103,
        originXData: '2022-04-15',
        type: 'Others'
      },
      {
        x: 37,
        y: 0.07186915826544578,
        originXData: '2022-04-16',
        type: 'Others'
      },
      {
        x: 38,
        y: 0.13298789816789602,
        originXData: '2022-04-17',
        type: 'Others'
      },
      {
        x: 39,
        y: 0.002498664507185538,
        originXData: '2022-04-18',
        type: 'Others'
      },
      {
        x: 40,
        y: 0.23047255698181987,
        originXData: '2022-04-19',
        type: 'Others'
      },
      {
        x: 41,
        y: 0.2614287826126477,
        originXData: '2022-04-20',
        type: 'Others'
      },
      {
        x: 42,
        y: 0.1416942415946803,
        originXData: '2022-04-21',
        type: 'Others'
      },
      {
        x: 43,
        y: 0.16875110819471914,
        originXData: '2022-04-22',
        type: 'Others'
      },
      {
        x: 44,
        y: 0.17855071283439228,
        originXData: '2022-04-23',
        type: 'Others'
      },
      {
        x: 45,
        y: 0.19374483996277542,
        originXData: '2022-04-24',
        type: 'Others'
      },
      {
        x: 46,
        y: 0.15310293715544224,
        originXData: '2022-04-25',
        type: 'Others'
      },
      {
        x: 47,
        y: 0.054940671436646556,
        originXData: '2022-04-26',
        type: 'Others'
      },
      {
        x: 48,
        y: 0.15449255983596022,
        originXData: '2022-04-27',
        type: 'Others'
      },
      {
        x: 49,
        y: 0.013363330618058769,
        originXData: '2022-04-28',
        type: 'Others'
      },
      {
        x: 50,
        y: 0.04741482052942758,
        originXData: '2022-04-29',
        type: 'Others'
      },
      {
        x: 51,
        y: 0.20622154823735023,
        originXData: '2022-04-30',
        type: 'Others'
      },
      {
        x: 52,
        y: 0.06582002462369495,
        originXData: '2022-05-01',
        type: 'Others'
      },
      {
        x: 53,
        y: 0.09378151773093113,
        originXData: '2022-05-02',
        type: 'Others'
      },
      {
        x: 54,
        y: 0.020396192047011766,
        originXData: '2022-05-03',
        type: 'Others'
      },
      {
        x: 55,
        y: 0.18516266015947339,
        originXData: '2022-05-04',
        type: 'Others'
      },
      {
        x: 56,
        y: 0.10161741887065481,
        originXData: '2022-05-05',
        type: 'Others'
      },
      {
        x: 57,
        y: 0.1770505715131574,
        originXData: '2022-05-06',
        type: 'Others'
      },
      {
        x: 58,
        y: 0.11339797878184575,
        originXData: '2022-05-07',
        type: 'Others'
      },
      {
        x: 59,
        y: 0.14515252680521537,
        originXData: '2022-05-08',
        type: 'Others'
      },
      {
        x: 60,
        y: 0.26957310267383333,
        originXData: '2022-05-09',
        type: 'Others'
      },
      {
        x: 61,
        y: 0.19599754596225075,
        originXData: '2022-05-10',
        type: 'Others'
      },
      {
        x: 62,
        y: 0.17669944891975334,
        originXData: '2022-05-11',
        type: 'Others'
      },
      {
        x: 63,
        y: 0.1558657621841565,
        originXData: '2022-05-12',
        type: 'Others'
      },
      {
        x: 64,
        y: 0.059105464959508816,
        originXData: '2022-05-13',
        type: 'Others'
      },
      {
        x: 65,
        y: 0.12362337826604534,
        originXData: '2022-05-14',
        type: 'Others'
      },
      {
        x: 66,
        y: 0.15828457651759154,
        originXData: '2022-05-15',
        type: 'Others'
      },
      {
        x: 67,
        y: 0.16477088382957397,
        originXData: '2022-05-16',
        type: 'Others'
      },
      {
        x: 68,
        y: 0.18942277783699418,
        originXData: '2022-05-17',
        type: 'Others'
      },
      {
        x: 69,
        y: 0.09183608563616476,
        originXData: '2022-05-18',
        type: 'Others'
      },
      {
        x: 70,
        y: 0.11050570522075298,
        originXData: '2022-05-19',
        type: 'Others'
      },
      {
        x: 71,
        y: 0.27962609951245393,
        originXData: '2022-05-20',
        type: 'Others'
      },
      {
        x: 72,
        y: 0.03528028179470999,
        originXData: '2022-05-21',
        type: 'Others'
      },
      {
        x: 73,
        y: 0.05384340884433819,
        originXData: '2022-05-22',
        type: 'Others'
      },
      {
        x: 74,
        y: 0.2566109634380092,
        originXData: '2022-05-23',
        type: 'Others'
      },
      {
        x: 75,
        y: 0.04706710842769647,
        originXData: '2022-05-24',
        type: 'Others'
      },
      {
        x: 76,
        y: 0.0690497936642742,
        originXData: '2022-05-25',
        type: 'Others'
      },
      {
        x: 77,
        y: 0.22240850644149432,
        originXData: '2022-05-26',
        type: 'Others'
      },
      {
        x: 78,
        y: 0.25247664377313944,
        originXData: '2022-05-27',
        type: 'Others'
      },
      {
        x: 79,
        y: 0.040225106713192425,
        originXData: '2022-05-28',
        type: 'Others'
      },
      {
        x: 80,
        y: 0.163839716976959,
        originXData: '2022-05-29',
        type: 'Others'
      },
      {
        x: 81,
        y: 0.07390521222877466,
        originXData: '2022-05-30',
        type: 'Others'
      },
      {
        x: 82,
        y: 0.012491096724084544,
        originXData: '2022-05-31',
        type: 'Others'
      },
      {
        x: 83,
        y: 0.10259216712446957,
        originXData: '2022-06-01',
        type: 'Others'
      },
      {
        x: 84,
        y: 0.08823120890048103,
        originXData: '2022-06-02',
        type: 'Others'
      },
      {
        x: 85,
        y: 0.09010761416766332,
        originXData: '2022-06-03',
        type: 'Others'
      },
      {
        x: 86,
        y: 0.04192469399478194,
        originXData: '2022-06-04',
        type: 'Others'
      },
      {
        x: 87,
        y: 0.11732142545122648,
        originXData: '2022-06-05',
        type: 'Others'
      },
      {
        x: 88,
        y: 0.18585780122660603,
        originXData: '2022-06-06',
        type: 'Others'
      },
      {
        x: 89,
        y: 0.0870820363115993,
        originXData: '2022-06-07',
        type: 'Others'
      },
      {
        x: 90,
        y: 0.2826807478126429,
        originXData: '2022-06-08',
        type: 'Others'
      },
      {
        x: 91,
        y: 0.06430150639799394,
        originXData: '2022-06-09',
        type: 'Others'
      },
      {
        x: 92,
        y: 0.16911472425643598,
        originXData: '2022-06-10',
        type: 'Others'
      },
      {
        x: 93,
        y: 0.04418197716587454,
        originXData: '2022-06-11',
        type: 'Others'
      },
      {
        x: 94,
        y: 0.05620634466431073,
        originXData: '2022-06-12',
        type: 'Others'
      },
      {
        x: 95,
        y: 0.09831084516203888,
        originXData: '2022-06-13',
        type: 'Others'
      },
      {
        x: 96,
        y: 0.09479199824809702,
        originXData: '2022-06-14',
        type: 'Others'
      },
      {
        x: 97,
        y: 0.051668527899557275,
        originXData: '2022-06-15',
        type: 'Others'
      },
      {
        x: 98,
        y: 0.058331438549321345,
        originXData: '2022-06-16',
        type: 'Others'
      },
      {
        x: 99,
        y: 0.23034428608925023,
        originXData: '2022-06-17',
        type: 'Others'
      },
      {
        x: 100,
        y: 0.20177663186099093,
        originXData: '2022-06-18',
        type: 'Others'
      },
      {
        x: 101,
        y: 0.18978717005592927,
        originXData: '2022-06-19',
        type: 'Others'
      },
      {
        x: 102,
        y: 0.28782493963004174,
        originXData: '2022-06-20',
        type: 'Others'
      },
      {
        x: 103,
        y: 0.1467829353931672,
        originXData: '2022-06-21',
        type: 'Others'
      },
      {
        x: 104,
        y: 0.128230433126852,
        originXData: '2022-06-22',
        type: 'Others'
      },
      {
        x: 105,
        y: 0.0548449051449372,
        originXData: '2022-06-23',
        type: 'Others'
      },
      {
        x: 106,
        y: 0.13419037997388159,
        originXData: '2022-06-24',
        type: 'Others'
      },
      {
        x: 107,
        y: 0.03650370242329377,
        originXData: '2022-06-25',
        type: 'Others'
      },
      {
        x: 108,
        y: 0.11300795916055194,
        originXData: '2022-06-26',
        type: 'Others'
      },
      {
        x: 109,
        y: 0.2892243111269155,
        originXData: '2022-06-27',
        type: 'Others'
      },
      {
        x: 110,
        y: 0.12881197140544712,
        originXData: '2022-06-28',
        type: 'Others'
      },
      {
        x: 111,
        y: 0.08568882796496745,
        originXData: '2022-06-29',
        type: 'Others'
      },
      {
        x: 112,
        y: 0.1876531712328392,
        originXData: '2022-06-30',
        type: 'Others'
      },
      {
        x: 113,
        y: 0.12802513423936035,
        originXData: '2022-07-01',
        type: 'Others'
      },
      {
        x: 114,
        y: 0.04085275656525246,
        originXData: '2022-07-02',
        type: 'Others'
      },
      {
        x: 115,
        y: 0.11571890266638503,
        originXData: '2022-07-03',
        type: 'Others'
      },
      {
        x: 116,
        y: 0.0506988188387463,
        originXData: '2022-07-04',
        type: 'Others'
      },
      {
        x: 117,
        y: 0.1494689703003086,
        originXData: '2022-07-05',
        type: 'Others'
      },
      {
        x: 118,
        y: 0.27730792196171267,
        originXData: '2022-07-06',
        type: 'Others'
      },
      {
        x: 119,
        y: 0.06055467590069835,
        originXData: '2022-07-07',
        type: 'Others'
      },
      {
        x: 120,
        y: 0.07687827184447993,
        originXData: '2022-07-08',
        type: 'Others'
      },
      {
        x: 121,
        y: 0.2566842936513114,
        originXData: '2022-07-09',
        type: 'Others'
      },
      {
        x: 122,
        y: 0.09887321357707671,
        originXData: '2022-07-10',
        type: 'Others'
      },
      {
        x: 123,
        y: 0.02730324273499053,
        originXData: '2022-07-11',
        type: 'Others'
      },
      {
        x: 124,
        y: 0.06536264665124339,
        originXData: '2022-07-12',
        type: 'Others'
      },
      {
        x: 125,
        y: 0.18847345356749562,
        originXData: '2022-07-13',
        type: 'Others'
      },
      {
        x: 126,
        y: 0.28310751524370814,
        originXData: '2022-07-14',
        type: 'Others'
      },
      {
        x: 127,
        y: 0.04893307176362374,
        originXData: '2022-07-15',
        type: 'Others'
      },
      {
        x: 128,
        y: 0.05023463131640375,
        originXData: '2022-07-16',
        type: 'Others'
      },
      {
        x: 129,
        y: 0.1817991933208958,
        originXData: '2022-07-17',
        type: 'Others'
      },
      {
        x: 130,
        y: 0.041091429149233895,
        originXData: '2022-07-18',
        type: 'Others'
      },
      {
        x: 131,
        y: 0.2152272967544634,
        originXData: '2022-07-19',
        type: 'Others'
      },
      {
        x: 132,
        y: 0.2294092597480583,
        originXData: '2022-07-20',
        type: 'Others'
      },
      {
        x: 133,
        y: 0.04812026594860752,
        originXData: '2022-07-21',
        type: 'Others'
      },
      {
        x: 134,
        y: 0.15062608602077723,
        originXData: '2022-07-22',
        type: 'Others'
      },
      {
        x: 135,
        y: 0.04674341937375404,
        originXData: '2022-07-23',
        type: 'Others'
      },
      {
        x: 136,
        y: 0.004691953334433059,
        originXData: '2022-07-24',
        type: 'Others'
      },
      {
        x: 137,
        y: 0.2347717591286564,
        originXData: '2022-07-25',
        type: 'Others'
      },
      {
        x: 138,
        y: 0.0949449243680592,
        originXData: '2022-07-26',
        type: 'Others'
      },
      {
        x: 139,
        y: 0.0025869855432198155,
        originXData: '2022-07-27',
        type: 'Others'
      },
      {
        x: 140,
        y: 0.16298210425832638,
        originXData: '2022-07-28',
        type: 'Others'
      },
      {
        x: 141,
        y: 0.04294961250823847,
        originXData: '2022-07-29',
        type: 'Others'
      },
      {
        x: 142,
        y: 0.23218888847906793,
        originXData: '2022-07-30',
        type: 'Others'
      },
      {
        x: 143,
        y: 0.13214197196191788,
        originXData: '2022-07-31',
        type: 'Others'
      },
      {
        x: 144,
        y: 0.23639487247464253,
        originXData: '2022-08-01',
        type: 'Others'
      },
      {
        x: 145,
        y: 0.2198732786335028,
        originXData: '2022-08-02',
        type: 'Others'
      },
      {
        x: 146,
        y: 0.09819916842568255,
        originXData: '2022-08-03',
        type: 'Others'
      },
      {
        x: 147,
        y: 0.2115038338762922,
        originXData: '2022-08-04',
        type: 'Others'
      },
      {
        x: 148,
        y: 0.27763124426038616,
        originXData: '2022-08-05',
        type: 'Others'
      },
      {
        x: 149,
        y: 0.2409936721598261,
        originXData: '2022-08-06',
        type: 'Others'
      },
      {
        x: 150,
        y: 0.005052818869306636,
        originXData: '2022-08-07',
        type: 'Others'
      },
      {
        x: 151,
        y: 0.10509982509852842,
        originXData: '2022-08-08',
        type: 'Others'
      },
      {
        x: 152,
        y: 0.14684738504256475,
        originXData: '2022-08-09',
        type: 'Others'
      },
      {
        x: 153,
        y: 0.06986602610353633,
        originXData: '2022-08-10',
        type: 'Others'
      },
      {
        x: 154,
        y: 0.13023043447411542,
        originXData: '2022-08-11',
        type: 'Others'
      },
      {
        x: 155,
        y: 0.12264398311386293,
        originXData: '2022-08-12',
        type: 'Others'
      },
      {
        x: 156,
        y: 0.20382835554590054,
        originXData: '2022-08-13',
        type: 'Others'
      },
      {
        x: 157,
        y: 0.11198492143289837,
        originXData: '2022-08-14',
        type: 'Others'
      },
      {
        x: 158,
        y: 0.07253893276910192,
        originXData: '2022-08-15',
        type: 'Others'
      },
      {
        x: 159,
        y: 0.15861094511518986,
        originXData: '2022-08-16',
        type: 'Others'
      },
      {
        x: 160,
        y: 0.022509784190967996,
        originXData: '2022-08-17',
        type: 'Others'
      },
      {
        x: 161,
        y: 0.07739714475795986,
        originXData: '2022-08-18',
        type: 'Others'
      },
      {
        x: 162,
        y: 0.05940452504975817,
        originXData: '2022-08-19',
        type: 'Others'
      },
      {
        x: 163,
        y: 0.22652737632082653,
        originXData: '2022-08-20',
        type: 'Others'
      },
      {
        x: 164,
        y: 0.09417964564260689,
        originXData: '2022-08-21',
        type: 'Others'
      },
      {
        x: 165,
        y: 0.31222056741049686,
        originXData: '2022-08-22',
        type: 'Others'
      },
      {
        x: 166,
        y: 0.013723402827825214,
        originXData: '2022-08-23',
        type: 'Others'
      },
      {
        x: 167,
        y: 0.1677747137304682,
        originXData: '2022-08-24',
        type: 'Others'
      },
      {
        x: 168,
        y: 0.11204260848132035,
        originXData: '2022-08-25',
        type: 'Others'
      },
      {
        x: 169,
        y: 0.1582346072173578,
        originXData: '2022-08-26',
        type: 'Others'
      },
      {
        x: 170,
        y: 0.1341413906744606,
        originXData: '2022-08-27',
        type: 'Others'
      },
      {
        x: 171,
        y: 0.13629356138973928,
        originXData: '2022-08-28',
        type: 'Others'
      },
      {
        x: 172,
        y: 0.21164869928303595,
        originXData: '2022-08-29',
        type: 'Others'
      },
      {
        x: 173,
        y: 0.013993773801955914,
        originXData: '2022-08-30',
        type: 'Others'
      },
      {
        x: 174,
        y: 0.057582671694496976,
        originXData: '2022-08-31',
        type: 'Others'
      },
      {
        x: 175,
        y: 0.17667401662601473,
        originXData: '2022-09-01',
        type: 'Others'
      },
      {
        x: 176,
        y: 0.1877708486581661,
        originXData: '2022-09-02',
        type: 'Others'
      },
      {
        x: 177,
        y: 0.02921282831170386,
        originXData: '2022-09-03',
        type: 'Others'
      },
      {
        x: 178,
        y: 0.18747152615768573,
        originXData: '2022-09-04',
        type: 'Others'
      },
      {
        x: 179,
        y: 0.03413689752079186,
        originXData: '2022-09-05',
        type: 'Others'
      },
      {
        x: 180,
        y: 0.032656498599706374,
        originXData: '2022-09-06',
        type: 'Others'
      }
    ]
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

### Donut Chart Indicator Card

In donut charts, indicator cards are often used to display total data or data from a specific sector during interaction.

```javascript livedemo
const data = [
  { type: 'oxygen', value: '46.60', formula: 'O', texture: 'circle' },
  { type: 'silicon', value: '27.72', formula: 'Si', texture: 'horizontal-line' },
  { type: 'aluminum', value: '8.13', formula: 'Al', texture: 'vertical-line' },
  { type: 'iron', value: '5', formula: 'Fe', texture: 'rect' },
  { type: 'calcium', value: '3.63', formula: 'Ca', texture: 'grid' },
  { type: 'sodium', value: '2.83', formula: 'Na', texture: 'bias-rl' },
  { type: 'potassium', value: '2.59', formula: 'K', texture: 'diamond' },
  { type: 'others', value: '3.5', formula: 'Others', texture: 'bias-lr' }
];
const spec = {
  type: 'pie',
  data: [
    {
      id: 'id0',
      values: data
    }
  ],
  outerRadius: 0.8,
  innerRadius: 0.5,
  padAngle: 0.6,
  valueField: 'value',
  categoryField: 'type',
  pie: {
    style: {
      cornerRadius: 10
    },
    state: {
      hover: {
        outerRadius: 0.85,
        stroke: '#000',
        lineWidth: 1
      },
      selected: {
        outerRadius: 0.85,
        stroke: '#000',
        lineWidth: 1
      }
    }
  },
  title: {
    visible: true,
    text: 'Surface element content statistics'
  },
  indicator: {
    visible: true,
    trigger: 'hover',
    limitRatio: 0.4,
    title: {
      visible: true,
      autoFit: true,
      style: {
        fontWeight: 'bolder',
        fontFamily: 'Times New Roman',
        fill: '#888',
        text: datum => {
          const d = datum ?? data[0];
          return d['formula'];
        }
      }
    },
    content: [
      {
        visible: true,
        style: {
          fontSize: 20,
          fill: 'orange',
          fontWeight: 'bolder',
          fontFamily: 'Times New Roman',
          text: datum => {
            const d = datum ?? data[0];
            return d['type'];
          }
        }
      },
      {
        visible: true,
        style: {
          fontSize: 18,
          fill: 'orange',
          fontFamily: 'Times New Roman',
          text: datum => {
            const d = datum ?? data[0];
            return d['value'] + '%';
          }
        }
      }
    ]
  },
  legends: {
    visible: true,
    orient: 'left',
    item: {
      shape: {
        style: {
          symbolType: 'circle',
          texture: datum => datum['texture']
        }
      }
    }
  },
  tooltip: {
    mark: {
      content: [
        {
          key: datum => datum['type'],
          value: datum => datum['value'] + '%'
        }
      ]
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
```

### Graphic Elements and Styles

#### Texture Filling

By configuring the ` pieChart.pie.style.texture` attribute, you can configure the texture fill for graphic elements. This configuration applies to all graphic elements. For details, see [Graphic Element Texture Configuration](todo)

| Keyword        | Type                  | Description                                              | Default Value |
| -------------- | --------------------- | -------------------------------------------------------- | ------------- |
| texture        | TextureType ｜ string | Texture of arc graphic element                           |               |
| textureColor   | string                | Color of the texture for the arc graphic element         |               |
| textureSize    | number                | Size of the texture for arc graphic element              |               |
| texturePadding | number                | Size of the gap between textures for arc graphic element |               |

TextureType is defined as follows:

```ts
type TextureType = 'circle' | 'dimond' | 'rect' | 'vertical-line' | 'horizontal-line' | 'bias-lr' | 'bias-rl' | 'grid';
```

The following example shows the effect of applying texture filling in a pie chart

```javascript livedemo
const data = [
  { type: 'oxygen', value: '46.60', formula: 'O', texture: 'circle' },
  { type: 'silicon', value: '27.72', formula: 'Si', texture: 'horizontal-line' },
  { type: 'aluminum', value: '8.13', formula: 'Al', texture: 'vertical-line' },
  { type: 'iron', value: '5', formula: 'Fe', texture: 'rect' },
  { type: 'calcium', value: '3.63', formula: 'Ca', texture: 'grid' },
  { type: 'sodium', value: '2.83', formula: 'Na', texture: 'bias-rl' },
  { type: 'potassium', value: '2.59', formula: 'K', texture: 'diamond' },
  { type: 'others', value: '3.5', formula: 'Others', texture: 'bias-lr' }
];
const spec = {
  type: 'pie',
  data: [
    {
      id: 'id0',
      values: data
    }
  ],
  outerRadius: 0.8,
  innerRadius: 0.5,
  padAngle: 0.6,
  valueField: 'value',
  categoryField: 'type',
  pie: {
    style: {
      cornerRadius: 5,
      texture: datum => datum['texture']
    },
    state: {
      hover: {
        outerRadius: 0.85,
        stroke: '#000',
        lineWidth: 1
      },
      selected: {
        outerRadius: 0.85,
        stroke: '#000',
        lineWidth: 1
      }
    }
  },
  title: {
    visible: true,
    text: 'Surface element content statistics'
  },
  legends: {
    visible: true,
    orient: 'left',
    item: {
      shape: {
        style: {
          symbolType: 'circle',
          texture: datum => datum['texture']
        }
      }
    }
  },
  tooltip: {
    mark: {
      content: [
        {
          key: datum => datum['type'],
          value: datum => datum['value'] + '%'
        }
      ]
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```
