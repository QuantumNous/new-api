# 组合图滚动条如何设置？

## 问题描述

类似 （https://www.visactor.io/vchart/demo/combination/col-line）这样的组合图，通常有多个轴或多个数据区域，我应该如何配置滚动条从而使其控制指定区域的滚动？
[common chart scrollbar](/vchart/faq/11-0.png)

## 解决方案

对于简单的组合图而言，您可以像普通图表一样声明滚动条，只需声明表示位置的属性`scrollBar.orient`和表示视口范围的属性`scrollBar.start`和`scrollBar.end`即可，如下图所示：
[common chart scrollbar](/vchart/faq/11-1.png)

而对于复杂图表而言，您需要两个配置步骤：

1. 为滚动条绑定坐标轴：
   通过`scrollBar.axisIndex`或`scrollBar.axisId`将滚动条与坐标轴进行关联，方可基于坐标轴进行数据筛选或图元范围滚动操作。
2. 为滚动条声明布局位置：
   您图中涉及的图表是基于 grid 布局绘制的，所以需要定义滚动条的布局位置。

- 首先，需要在`grid.row`的行数声明中添加一行用于放置横向滚动。
- 其次，需要在`grid.elements`中声明滚动条的布局信息

```ts
  {
    modelId: 'scrollBar', // id
    col: 0, // col index
    row: 6 // row index
  },
```

- 最后，需要将 scrollBar.id 与 grid.elements 中的 modelId 对应起来。

```ts
scrollBar: [
  {
    orient: 'bottom',
    axisIndex: 4,
    id: 'scrollBar',
    start: 0,
    end: 0.4
  }
];
```

## 代码示例

```javascript livedemo
const leftAxesCommonSpec = {
  expand: { max: 0.2 },
  label: { flush: true, visible: true },
  tick: { visible: false },
  forceTickCount: 3
};
const spec = {
  type: 'common',
  layout: {
    type: 'grid',
    col: 2,
    row: 7,
    elements: [
      {
        modelId: 'legend',
        col: 0,
        colSpan: 2,
        row: 6
      },
      {
        modelId: 'scrollBar',
        col: 0,
        colSpan: 2,
        row: 5
      },
      {
        modelId: 'Social Penetration',
        col: 1,
        row: 0
      },
      {
        modelId: 'Engagement - Socialization',
        col: 1,
        row: 1
      },
      {
        modelId: 'Penetration of Private Messages',
        col: 1,
        row: 2
      },
      {
        modelId: 'Number of Private Messages per User',
        col: 1,
        row: 3
      },
      {
        modelId: 'Social Penetrationleft',
        col: 0,
        row: 0
      },
      {
        modelId: 'Engagement - Socialization-left',
        col: 0,
        row: 1
      },
      {
        modelId: 'Penetration of Private Messagesleft',
        col: 0,
        row: 2
      },
      {
        modelId: 'Number of Private Messages per Userleft',
        col: 0,
        row: 3
      },
      {
        modelId: 'Number of Private Messages per User-bottom',
        col: 1,
        row: 4
      }
    ]
  },
  region: [
    {
      id: 'Social Penetration'
    },
    {
      id: 'Engagement - Socialization'
    },
    {
      id: 'Penetration of Private Messages'
    },
    {
      id: 'Number of Private Messages per User'
    }
  ],
  scrollBar: [
    {
      orient: 'bottom',
      axisIndex: 4,
      id: 'scrollBar',
      start: 0,
      end: 0.4,
      filterMode: 'axis'
    }
  ],
  legends: {
    padding: {
      top: 10
    },
    visible: true,
    orient: 'bottom',
    id: 'legend',
    regionId: [
      'Social Penetration',
      'Engagement - Socialization',
      'Penetration of Private Messages',
      'Number of Private Messages per User'
    ]
  },
  seriesField: 'type',
  tooltip: {
    dimension: {
      title: {
        value: datum => {
          return `第 ${datum.x} 天`;
        }
      },
      content: [
        {
          key: datum => datum.type,
          value: datum => datum.y
        }
      ]
    }
  },
  series: [
    {
      id: 'Social Penetrationseries0',
      regionId: 'Social Penetration',
      type: 'line',
      data: { id: 'Social Penetration' },
      xField: 'x',
      yField: 'y'
    },
    {
      id: 'Engagement - Socialization-series0',
      regionId: 'Engagement - Socialization',
      type: 'line',
      data: { id: 'Engagement - Socialization' },
      xField: 'x',
      yField: 'y'
    },
    {
      id: 'Penetration of Private Messagesseries0',
      regionId: 'Penetration of Private Messages',
      type: 'line',
      data: { id: 'Penetration of Private Messages' },
      xField: 'x',
      yField: 'y'
    },
    {
      id: 'Number of Private Messages per Userseries0',
      regionId: 'Number of Private Messages per User',
      type: 'line',
      data: { id: 'Number of Private Messages per User' },
      xField: 'x',
      yField: 'y'
    }
  ],
  axes: [
    {
      id: 'Social Penetrationleft',
      regionId: 'Social Penetration',
      orient: 'left',
      title: { visible: true, text: 'SP' },
      ...leftAxesCommonSpec
    },
    {
      id: 'Engagement - Socialization-left',
      regionId: 'Engagement - Socialization',
      orient: 'left',
      title: { visible: true, text: 'ES' },
      ...leftAxesCommonSpec
    },
    {
      id: 'Penetration of Private Messagesleft',
      regionId: 'Penetration of Private Messages',
      orient: 'left',
      title: { visible: true, text: 'Penetration of PM' },
      ...leftAxesCommonSpec
    },
    {
      id: 'Number of Private Messages per Userleft',
      regionId: 'Number of Private Messages per User',
      orient: 'left',
      title: { visible: true, text: 'PM per User' },
      ...leftAxesCommonSpec
    },
    {
      id: 'Number of Private Messages per User-bottom',
      regionId: [
        'Social Penetration',
        'Engagement - Socialization',
        'Penetration of Private Messages',
        'Number of Private Messages per User'
      ],
      orient: 'bottom',
      label: {
        firstVisible: true,
        lastVisible: true,
        visible: true
      },
      tick: { visible: false },
      paddingInner: 0.99,
      paddingOuter: 0
    }
  ]
};
const dataJson = {
  'Social Penetration': [
    {
      x: 0,
      y: 1.2020804451630671,
      originXData: '2022-03-08',
      type: 'Social Penetration'
    },
    {
      x: 1,
      y: 1.911162758594358,
      originXData: '2022-03-09',
      type: 'Social Penetration'
    },
    {
      x: 2,
      y: 0.919293523406533,
      originXData: '2022-03-10',
      type: 'Social Penetration'
    },
    {
      x: 3,
      y: 1.613617931982911,
      originXData: '2022-03-11',
      type: 'Social Penetration'
    },
    {
      x: 4,
      y: 1.121445896148114,
      originXData: '2022-03-12',
      type: 'Social Penetration'
    },
    {
      x: 5,
      y: 0.527369749651032,
      originXData: '2022-03-13',
      type: 'Social Penetration'
    },
    {
      x: 6,
      y: 0.07991167814791,
      originXData: '2022-03-14',
      type: 'Social Penetration'
    },
    {
      x: 7,
      y: 0.29341332300751205,
      originXData: '2022-03-15',
      type: 'Social Penetration'
    },
    {
      x: 8,
      y: 1.103150404211427,
      originXData: '2022-03-16',
      type: 'Social Penetration'
    },
    {
      x: 9,
      y: 0.38285701953593604,
      originXData: '2022-03-17',
      type: 'Social Penetration'
    },
    {
      x: 10,
      y: 0.8908005339482421,
      originXData: '2022-03-18',
      type: 'Social Penetration'
    },
    {
      x: 11,
      y: 0.8379933951719881,
      originXData: '2022-03-19',
      type: 'Social Penetration'
    },
    {
      x: 12,
      y: 2.913059895355856,
      originXData: '2022-03-20',
      type: 'Social Penetration'
    },
    {
      x: 13,
      y: 1.245523794769467,
      originXData: '2022-03-21',
      type: 'Social Penetration'
    },
    {
      x: 14,
      y: 1.801955367373218,
      originXData: '2022-03-22',
      type: 'Social Penetration'
    },
    {
      x: 15,
      y: 30.25170429439274,
      originXData: '2022-03-23',
      type: 'Social Penetration'
    },
    {
      x: 16,
      y: 2.084831170978463,
      originXData: '2022-03-24',
      type: 'Social Penetration'
    },
    {
      x: 17,
      y: 0.8300684679922911,
      originXData: '2022-03-25',
      type: 'Social Penetration'
    },
    {
      x: 18,
      y: 5.057522939533747,
      originXData: '2022-03-26',
      type: 'Social Penetration'
    },
    {
      x: 19,
      y: 1.364245041731511,
      originXData: '2022-03-27',
      type: 'Social Penetration'
    },
    {
      x: 20,
      y: 0.429699282814745,
      originXData: '2022-03-28',
      type: 'Social Penetration'
    },
    {
      x: 21,
      y: 8.636960050981939,
      originXData: '2022-03-29',
      type: 'Social Penetration'
    },
    {
      x: 22,
      y: 0.31233481070398905,
      originXData: '2022-03-30',
      type: 'Social Penetration'
    },
    {
      x: 23,
      y: 0.8979576483673781,
      originXData: '2022-03-31',
      type: 'Social Penetration'
    },
    {
      x: 24,
      y: 1.187326287404249,
      originXData: '2022-04-01',
      type: 'Social Penetration'
    },
    {
      x: 25,
      y: 0.013251966153457001,
      originXData: '2022-04-02',
      type: 'Social Penetration'
    },
    {
      x: 26,
      y: 0.150440921215681,
      originXData: '2022-04-03',
      type: 'Social Penetration'
    },
    {
      x: 27,
      y: 1.437865757864698,
      originXData: '2022-04-04',
      type: 'Social Penetration'
    },
    {
      x: 28,
      y: 19.70534531285437,
      originXData: '2022-04-05',
      type: 'Social Penetration'
    },
    {
      x: 29,
      y: 1.068708512330189,
      originXData: '2022-04-06',
      type: 'Social Penetration'
    },
    {
      x: 30,
      y: 3.239083103313066,
      originXData: '2022-04-07',
      type: 'Social Penetration'
    },
    {
      x: 31,
      y: 3.609669038457516,
      originXData: '2022-04-08',
      type: 'Social Penetration'
    },
    {
      x: 32,
      y: 0.8581543303200471,
      originXData: '2022-04-09',
      type: 'Social Penetration'
    },
    {
      x: 33,
      y: 1.235338424517758,
      originXData: '2022-04-10',
      type: 'Social Penetration'
    },
    {
      x: 34,
      y: 0.615560300356359,
      originXData: '2022-04-11',
      type: 'Social Penetration'
    },
    {
      x: 35,
      y: 3.5445165395901572,
      originXData: '2022-04-12',
      type: 'Social Penetration'
    },
    {
      x: 36,
      y: 1.037776502324676,
      originXData: '2022-04-13',
      type: 'Social Penetration'
    },
    {
      x: 37,
      y: 0.534866532613768,
      originXData: '2022-04-14',
      type: 'Social Penetration'
    },
    {
      x: 38,
      y: 3.225952049483959,
      originXData: '2022-04-15',
      type: 'Social Penetration'
    },
    {
      x: 39,
      y: 12.278592894400722,
      originXData: '2022-04-16',
      type: 'Social Penetration'
    },
    {
      x: 40,
      y: 0.411460847135642,
      originXData: '2022-04-17',
      type: 'Social Penetration'
    },
    {
      x: 41,
      y: 0.304818623987116,
      originXData: '2022-04-18',
      type: 'Social Penetration'
    },
    {
      x: 42,
      y: 0.8929797309154061,
      originXData: '2022-04-19',
      type: 'Social Penetration'
    },
    {
      x: 43,
      y: 4.074891060179412,
      originXData: '2022-04-20',
      type: 'Social Penetration'
    },
    {
      x: 44,
      y: 0.902423656543305,
      originXData: '2022-04-21',
      type: 'Social Penetration'
    },
    {
      x: 45,
      y: 0.868968791964932,
      originXData: '2022-04-22',
      type: 'Social Penetration'
    },
    {
      x: 46,
      y: 0.598986391584271,
      originXData: '2022-04-23',
      type: 'Social Penetration'
    },
    {
      x: 47,
      y: 0.27570721725353503,
      originXData: '2022-04-24',
      type: 'Social Penetration'
    },
    {
      x: 48,
      y: 0.38518667923696703,
      originXData: '2022-04-25',
      type: 'Social Penetration'
    },
    {
      x: 49,
      y: 0.622049495688147,
      originXData: '2022-04-26',
      type: 'Social Penetration'
    },
    {
      x: 50,
      y: 3.540727101774814,
      originXData: '2022-04-27',
      type: 'Social Penetration'
    },
    {
      x: 51,
      y: 2.742513433824975,
      originXData: '2022-04-28',
      type: 'Social Penetration'
    },
    {
      x: 52,
      y: 1.621566806821747,
      originXData: '2022-04-29',
      type: 'Social Penetration'
    },
    {
      x: 53,
      y: 2.352493741253538,
      originXData: '2022-04-30',
      type: 'Social Penetration'
    },
    {
      x: 54,
      y: 0.023487873849160002,
      originXData: '2022-05-01',
      type: 'Social Penetration'
    },
    {
      x: 55,
      y: 9.85187760463177,
      originXData: '2022-05-02',
      type: 'Social Penetration'
    },
    {
      x: 56,
      y: 6.3835439206943,
      originXData: '2022-05-03',
      type: 'Social Penetration'
    },
    {
      x: 57,
      y: 2.897597920598689,
      originXData: '2022-05-04',
      type: 'Social Penetration'
    },
    {
      x: 58,
      y: 0.147546385656207,
      originXData: '2022-05-05',
      type: 'Social Penetration'
    },
    {
      x: 59,
      y: 4.668438202775402,
      originXData: '2022-05-06',
      type: 'Social Penetration'
    },
    {
      x: 60,
      y: 1.868897716467347,
      originXData: '2022-05-07',
      type: 'Social Penetration'
    },
    {
      x: 61,
      y: 1.356875902669512,
      originXData: '2022-05-08',
      type: 'Social Penetration'
    },
    {
      x: 62,
      y: 1.029882775112869,
      originXData: '2022-05-09',
      type: 'Social Penetration'
    },
    {
      x: 63,
      y: 1.079419585437788,
      originXData: '2022-05-10',
      type: 'Social Penetration'
    },
    {
      x: 64,
      y: 0.43374835866466704,
      originXData: '2022-05-11',
      type: 'Social Penetration'
    },
    {
      x: 65,
      y: 0.6884004244125861,
      originXData: '2022-05-12',
      type: 'Social Penetration'
    },
    {
      x: 66,
      y: 0.5513219132650721,
      originXData: '2022-05-13',
      type: 'Social Penetration'
    },
    {
      x: 67,
      y: 0.26075436773203503,
      originXData: '2022-05-14',
      type: 'Social Penetration'
    },
    {
      x: 68,
      y: 3.534068370760441,
      originXData: '2022-05-15',
      type: 'Social Penetration'
    },
    {
      x: 69,
      y: 1.051684273070894,
      originXData: '2022-05-16',
      type: 'Social Penetration'
    },
    {
      x: 70,
      y: 0.8574030868970931,
      originXData: '2022-05-17',
      type: 'Social Penetration'
    },
    {
      x: 71,
      y: 0.515497463894879,
      originXData: '2022-05-18',
      type: 'Social Penetration'
    },
    {
      x: 72,
      y: 0.9592457438221671,
      originXData: '2022-05-19',
      type: 'Social Penetration'
    },
    {
      x: 73,
      y: 0.069882250377393,
      originXData: '2022-05-20',
      type: 'Social Penetration'
    },
    {
      x: 74,
      y: 10.360352568974609,
      originXData: '2022-05-21',
      type: 'Social Penetration'
    },
    {
      x: 75,
      y: 1.112796751785197,
      originXData: '2022-05-22',
      type: 'Social Penetration'
    },
    {
      x: 76,
      y: 4.891916669440483,
      originXData: '2022-05-23',
      type: 'Social Penetration'
    },
    {
      x: 77,
      y: 0.09534096170855301,
      originXData: '2022-05-24',
      type: 'Social Penetration'
    },
    {
      x: 78,
      y: 17.21160548866725,
      originXData: '2022-05-25',
      type: 'Social Penetration'
    },
    {
      x: 79,
      y: 0.9890377076819251,
      originXData: '2022-05-26',
      type: 'Social Penetration'
    },
    {
      x: 80,
      y: 1.207578684423282,
      originXData: '2022-05-27',
      type: 'Social Penetration'
    },
    {
      x: 81,
      y: 15.265265813052475,
      originXData: '2022-05-28',
      type: 'Social Penetration'
    },
    {
      x: 82,
      y: 1.667919015486645,
      originXData: '2022-05-29',
      type: 'Social Penetration'
    },
    {
      x: 83,
      y: 2.232083847244808,
      originXData: '2022-05-30',
      type: 'Social Penetration'
    },
    {
      x: 84,
      y: 1.113011174076138,
      originXData: '2022-05-31',
      type: 'Social Penetration'
    },
    {
      x: 85,
      y: 0.9839213173080511,
      originXData: '2022-06-01',
      type: 'Social Penetration'
    },
    {
      x: 86,
      y: 3.618368394111176,
      originXData: '2022-06-02',
      type: 'Social Penetration'
    },
    {
      x: 87,
      y: 1.5240830060491182,
      originXData: '2022-06-03',
      type: 'Social Penetration'
    },
    {
      x: 88,
      y: 0.7108355579615261,
      originXData: '2022-06-04',
      type: 'Social Penetration'
    },
    {
      x: 89,
      y: 1.842738679408876,
      originXData: '2022-06-05',
      type: 'Social Penetration'
    },
    {
      x: 90,
      y: 2.968986726243696,
      originXData: '2022-06-06',
      type: 'Social Penetration'
    },
    {
      x: 91,
      y: 0.30957106038382504,
      originXData: '2022-06-07',
      type: 'Social Penetration'
    },
    {
      x: 92,
      y: 3.077870353397237,
      originXData: '2022-06-08',
      type: 'Social Penetration'
    },
    {
      x: 93,
      y: 0.460474051903736,
      originXData: '2022-06-09',
      type: 'Social Penetration'
    },
    {
      x: 94,
      y: 0.9248894668614721,
      originXData: '2022-06-10',
      type: 'Social Penetration'
    },
    {
      x: 95,
      y: 0.5170229174882011,
      originXData: '2022-06-11',
      type: 'Social Penetration'
    },
    {
      x: 96,
      y: 1.343310704782682,
      originXData: '2022-06-12',
      type: 'Social Penetration'
    },
    {
      x: 97,
      y: 4.213284444567541,
      originXData: '2022-06-13',
      type: 'Social Penetration'
    },
    {
      x: 98,
      y: 0.718083714760927,
      originXData: '2022-06-14',
      type: 'Social Penetration'
    },
    {
      x: 99,
      y: 2.443370806389791,
      originXData: '2022-06-15',
      type: 'Social Penetration'
    },
    {
      x: 100,
      y: 3.594231845735735,
      originXData: '2022-06-16',
      type: 'Social Penetration'
    },
    {
      x: 101,
      y: 1.113951398490715,
      originXData: '2022-06-17',
      type: 'Social Penetration'
    },
    {
      x: 102,
      y: 0.5614439322266921,
      originXData: '2022-06-18',
      type: 'Social Penetration'
    },
    {
      x: 103,
      y: 1.243458727745012,
      originXData: '2022-06-19',
      type: 'Social Penetration'
    },
    {
      x: 104,
      y: 1.31005897849395,
      originXData: '2022-06-20',
      type: 'Social Penetration'
    },
    {
      x: 105,
      y: 0.572744269459053,
      originXData: '2022-06-21',
      type: 'Social Penetration'
    },
    {
      x: 106,
      y: 24.581669047338767,
      originXData: '2022-06-22',
      type: 'Social Penetration'
    },
    {
      x: 107,
      y: 0.47413969565051606,
      originXData: '2022-06-23',
      type: 'Social Penetration'
    },
    {
      x: 108,
      y: 0.43416765009011604,
      originXData: '2022-06-24',
      type: 'Social Penetration'
    },
    {
      x: 109,
      y: 0.943163264857342,
      originXData: '2022-06-25',
      type: 'Social Penetration'
    },
    {
      x: 110,
      y: 0.233205152479134,
      originXData: '2022-06-26',
      type: 'Social Penetration'
    },
    {
      x: 111,
      y: 3.9663605369632933,
      originXData: '2022-06-27',
      type: 'Social Penetration'
    },
    {
      x: 112,
      y: 0.016605232459512002,
      originXData: '2022-06-28',
      type: 'Social Penetration'
    },
    {
      x: 113,
      y: 1.374134760412724,
      originXData: '2022-06-29',
      type: 'Social Penetration'
    },
    {
      x: 114,
      y: 0.715486103147415,
      originXData: '2022-06-30',
      type: 'Social Penetration'
    },
    {
      x: 115,
      y: 0.747532331413809,
      originXData: '2022-07-01',
      type: 'Social Penetration'
    },
    {
      x: 116,
      y: 0.8670766655477491,
      originXData: '2022-07-02',
      type: 'Social Penetration'
    },
    {
      x: 117,
      y: 0.392542368674532,
      originXData: '2022-07-03',
      type: 'Social Penetration'
    },
    {
      x: 118,
      y: 2.354765436840968,
      originXData: '2022-07-04',
      type: 'Social Penetration'
    },
    {
      x: 119,
      y: 0.25059554847566,
      originXData: '2022-07-05',
      type: 'Social Penetration'
    },
    {
      x: 120,
      y: 4.720665637767317,
      originXData: '2022-07-06',
      type: 'Social Penetration'
    },
    {
      x: 121,
      y: 0.646476205877439,
      originXData: '2022-07-07',
      type: 'Social Penetration'
    },
    {
      x: 122,
      y: 4.428354777598469,
      originXData: '2022-07-08',
      type: 'Social Penetration'
    },
    {
      x: 123,
      y: 1.502467804494858,
      originXData: '2022-07-09',
      type: 'Social Penetration'
    },
    {
      x: 124,
      y: 11.706734521216822,
      originXData: '2022-07-10',
      type: 'Social Penetration'
    },
    {
      x: 125,
      y: 1.153083534578196,
      originXData: '2022-07-11',
      type: 'Social Penetration'
    },
    {
      x: 126,
      y: 1.4863362021332551,
      originXData: '2022-07-12',
      type: 'Social Penetration'
    },
    {
      x: 127,
      y: 1.61896686341972,
      originXData: '2022-07-13',
      type: 'Social Penetration'
    },
    {
      x: 128,
      y: 49.60818750100216,
      originXData: '2022-07-14',
      type: 'Social Penetration'
    },
    {
      x: 129,
      y: 1.785205883890873,
      originXData: '2022-07-15',
      type: 'Social Penetration'
    },
    {
      x: 130,
      y: 0.715594243310775,
      originXData: '2022-07-16',
      type: 'Social Penetration'
    },
    {
      x: 131,
      y: 0.8147430610328651,
      originXData: '2022-07-17',
      type: 'Social Penetration'
    },
    {
      x: 132,
      y: 1.24545618431753,
      originXData: '2022-07-18',
      type: 'Social Penetration'
    },
    {
      x: 133,
      y: 0.083915091025848,
      originXData: '2022-07-19',
      type: 'Social Penetration'
    },
    {
      x: 134,
      y: 0.32701962372413,
      originXData: '2022-07-20',
      type: 'Social Penetration'
    },
    {
      x: 135,
      y: 0.722041044814348,
      originXData: '2022-07-21',
      type: 'Social Penetration'
    },
    {
      x: 136,
      y: 10.662811760936936,
      originXData: '2022-07-22',
      type: 'Social Penetration'
    },
    {
      x: 137,
      y: 0.364677770561312,
      originXData: '2022-07-23',
      type: 'Social Penetration'
    },
    {
      x: 138,
      y: 0.9157754804402811,
      originXData: '2022-07-24',
      type: 'Social Penetration'
    },
    {
      x: 139,
      y: 0.67849525511577,
      originXData: '2022-07-25',
      type: 'Social Penetration'
    },
    {
      x: 140,
      y: 1.330066578741473,
      originXData: '2022-07-26',
      type: 'Social Penetration'
    },
    {
      x: 141,
      y: 5.686664774275858,
      originXData: '2022-07-27',
      type: 'Social Penetration'
    },
    {
      x: 142,
      y: 0.22324041916141402,
      originXData: '2022-07-28',
      type: 'Social Penetration'
    },
    {
      x: 143,
      y: 2.476037411183793,
      originXData: '2022-07-29',
      type: 'Social Penetration'
    },
    {
      x: 144,
      y: 0.773637653847835,
      originXData: '2022-07-30',
      type: 'Social Penetration'
    },
    {
      x: 145,
      y: 0.169152723468269,
      originXData: '2022-07-31',
      type: 'Social Penetration'
    },
    {
      x: 146,
      y: 1.519627178758216,
      originXData: '2022-08-01',
      type: 'Social Penetration'
    },
    {
      x: 147,
      y: 3.545652606242915,
      originXData: '2022-08-02',
      type: 'Social Penetration'
    },
    {
      x: 148,
      y: 1.3404062798488199,
      originXData: '2022-08-03',
      type: 'Social Penetration'
    },
    {
      x: 149,
      y: 0.6530263834012761,
      originXData: '2022-08-04',
      type: 'Social Penetration'
    },
    {
      x: 150,
      y: 0.708729075421144,
      originXData: '2022-08-05',
      type: 'Social Penetration'
    },
    {
      x: 151,
      y: 11.986631123295103,
      originXData: '2022-08-06',
      type: 'Social Penetration'
    },
    {
      x: 152,
      y: 1.232939713701664,
      originXData: '2022-08-07',
      type: 'Social Penetration'
    },
    {
      x: 153,
      y: 0.530813431405317,
      originXData: '2022-08-08',
      type: 'Social Penetration'
    },
    {
      x: 154,
      y: 2.510188659097596,
      originXData: '2022-08-09',
      type: 'Social Penetration'
    },
    {
      x: 155,
      y: 1.622456744339298,
      originXData: '2022-08-10',
      type: 'Social Penetration'
    },
    {
      x: 156,
      y: 0.25962103068208003,
      originXData: '2022-08-11',
      type: 'Social Penetration'
    },
    {
      x: 157,
      y: 0.884113805589634,
      originXData: '2022-08-12',
      type: 'Social Penetration'
    },
    {
      x: 158,
      y: 8.624685230360152,
      originXData: '2022-08-13',
      type: 'Social Penetration'
    },
    {
      x: 159,
      y: 1.6498217904306332,
      originXData: '2022-08-14',
      type: 'Social Penetration'
    },
    {
      x: 160,
      y: 5.840124155766275,
      originXData: '2022-08-15',
      type: 'Social Penetration'
    },
    {
      x: 161,
      y: 2.405030143824614,
      originXData: '2022-08-16',
      type: 'Social Penetration'
    },
    {
      x: 162,
      y: 1.034391306438299,
      originXData: '2022-08-17',
      type: 'Social Penetration'
    },
    {
      x: 163,
      y: 4.703412413763946,
      originXData: '2022-08-18',
      type: 'Social Penetration'
    },
    {
      x: 164,
      y: 0.22138733877979702,
      originXData: '2022-08-19',
      type: 'Social Penetration'
    },
    {
      x: 165,
      y: 0.14621922149563202,
      originXData: '2022-08-20',
      type: 'Social Penetration'
    },
    {
      x: 166,
      y: 5.702011116768989,
      originXData: '2022-08-21',
      type: 'Social Penetration'
    },
    {
      x: 167,
      y: 2.289251748782675,
      originXData: '2022-08-22',
      type: 'Social Penetration'
    },
    {
      x: 168,
      y: 0.40156922050687605,
      originXData: '2022-08-23',
      type: 'Social Penetration'
    },
    {
      x: 169,
      y: 16.368686321533847,
      originXData: '2022-08-24',
      type: 'Social Penetration'
    },
    {
      x: 170,
      y: 17.325634435909638,
      originXData: '2022-08-25',
      type: 'Social Penetration'
    },
    {
      x: 171,
      y: 2.771994472181008,
      originXData: '2022-08-26',
      type: 'Social Penetration'
    },
    {
      x: 172,
      y: 2.705080627435551,
      originXData: '2022-08-27',
      type: 'Social Penetration'
    },
    {
      x: 173,
      y: 0.366184071525715,
      originXData: '2022-08-28',
      type: 'Social Penetration'
    },
    {
      x: 174,
      y: 0.192969279119436,
      originXData: '2022-08-29',
      type: 'Social Penetration'
    },
    {
      x: 175,
      y: 0.248116517168076,
      originXData: '2022-08-30',
      type: 'Social Penetration'
    },
    {
      x: 176,
      y: 0.7172605174280461,
      originXData: '2022-08-31',
      type: 'Social Penetration'
    },
    {
      x: 177,
      y: 0.259653267575217,
      originXData: '2022-09-01',
      type: 'Social Penetration'
    },
    {
      x: 178,
      y: 1.398428414171018,
      originXData: '2022-09-02',
      type: 'Social Penetration'
    },
    {
      x: 179,
      y: 1.7166677805176591,
      originXData: '2022-09-03',
      type: 'Social Penetration'
    }
  ],
  'Engagement - Socialization': [
    {
      x: 0,
      y: 0.7782279444864411,
      originXData: '2022-03-08',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 1,
      y: 0.6970763116149991,
      originXData: '2022-03-09',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 2,
      y: 0.6754510401577041,
      originXData: '2022-03-10',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 3,
      y: 4.391274420824463,
      originXData: '2022-03-11',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 4,
      y: 0.5827973501093221,
      originXData: '2022-03-12',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 5,
      y: 0.321443063009525,
      originXData: '2022-03-13',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 6,
      y: 0.9838146243033221,
      originXData: '2022-03-14',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 7,
      y: 0.225492098355163,
      originXData: '2022-03-15',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 8,
      y: 0.580792120371675,
      originXData: '2022-03-16',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 9,
      y: 0.510579334822959,
      originXData: '2022-03-17',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 10,
      y: 1.656998380732747,
      originXData: '2022-03-18',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 11,
      y: 1.372238730132033,
      originXData: '2022-03-19',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 12,
      y: 3.375041306488803,
      originXData: '2022-03-20',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 13,
      y: 0.5770535812918991,
      originXData: '2022-03-21',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 14,
      y: 2.562767955961243,
      originXData: '2022-03-22',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 15,
      y: 60.10096481599735,
      originXData: '2022-03-23',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 16,
      y: 2.824195229461953,
      originXData: '2022-03-24',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 17,
      y: 0.37108301055861304,
      originXData: '2022-03-25',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 18,
      y: 6.8131452572139555,
      originXData: '2022-03-26',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 19,
      y: 0.993289299105189,
      originXData: '2022-03-27',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 20,
      y: 0.27225365805664004,
      originXData: '2022-03-28',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 21,
      y: 2.663368864789215,
      originXData: '2022-03-29',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 22,
      y: 1.136502929086737,
      originXData: '2022-03-30',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 23,
      y: 0.8268293005130081,
      originXData: '2022-03-31',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 24,
      y: 1.2824253532703072,
      originXData: '2022-04-01',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 25,
      y: 1.580091614771022,
      originXData: '2022-04-02',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 26,
      y: 0.7793382242254321,
      originXData: '2022-04-03',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 27,
      y: 0.34207119701235905,
      originXData: '2022-04-04',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 28,
      y: 4.144335050792541,
      originXData: '2022-04-05',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 29,
      y: 1.336025709304907,
      originXData: '2022-04-06',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 30,
      y: 0.9037359185383671,
      originXData: '2022-04-07',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 31,
      y: 13.698767079174356,
      originXData: '2022-04-08',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 32,
      y: 1.11771091972957,
      originXData: '2022-04-09',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 33,
      y: 0.5546236200208831,
      originXData: '2022-04-10',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 34,
      y: 0.133505664394376,
      originXData: '2022-04-11',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 35,
      y: 8.458105165611851,
      originXData: '2022-04-12',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 36,
      y: 1.412321112593621,
      originXData: '2022-04-13',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 37,
      y: 0.577163861285873,
      originXData: '2022-04-14',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 38,
      y: 5.112791338669762,
      originXData: '2022-04-15',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 39,
      y: 13.301401633991011,
      originXData: '2022-04-16',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 40,
      y: 0.8194099242420241,
      originXData: '2022-04-17',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 41,
      y: 0.601409275693432,
      originXData: '2022-04-18',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 42,
      y: 0.932019259560644,
      originXData: '2022-04-19',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 43,
      y: 3.6166710941152713,
      originXData: '2022-04-20',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 44,
      y: 2.682237126638688,
      originXData: '2022-04-21',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 45,
      y: 0.329339479566271,
      originXData: '2022-04-22',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 46,
      y: 0.923756524041317,
      originXData: '2022-04-23',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 47,
      y: 0.6601580208066361,
      originXData: '2022-04-24',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 48,
      y: 2.037027697748363,
      originXData: '2022-04-25',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 49,
      y: 0.803863499657206,
      originXData: '2022-04-26',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 50,
      y: 0.651469202290988,
      originXData: '2022-04-27',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 51,
      y: 2.6893975459595643,
      originXData: '2022-04-28',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 52,
      y: 0.9147556633717211,
      originXData: '2022-04-29',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 53,
      y: 3.463127996997362,
      originXData: '2022-04-30',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 54,
      y: 0.5573480476128151,
      originXData: '2022-05-01',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 55,
      y: 35.95040240058573,
      originXData: '2022-05-02',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 56,
      y: 5.577920982650984,
      originXData: '2022-05-03',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 57,
      y: 5.106082630695584,
      originXData: '2022-05-04',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 58,
      y: 0.040771286126692,
      originXData: '2022-05-05',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 59,
      y: 0.23681078820699203,
      originXData: '2022-05-06',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 60,
      y: 1.727448921279463,
      originXData: '2022-05-07',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 61,
      y: 1.434740383567053,
      originXData: '2022-05-08',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 62,
      y: 0.9377192673786531,
      originXData: '2022-05-09',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 63,
      y: 0.5840348488590831,
      originXData: '2022-05-10',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 64,
      y: 0.01643698693241,
      originXData: '2022-05-11',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 65,
      y: 1.538028843999251,
      originXData: '2022-05-12',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 66,
      y: 1.063801968030616,
      originXData: '2022-05-13',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 67,
      y: 0.16980099784180802,
      originXData: '2022-05-14',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 68,
      y: 2.144086432206532,
      originXData: '2022-05-15',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 69,
      y: 1.152664833294427,
      originXData: '2022-05-16',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 70,
      y: 0.8751363341872681,
      originXData: '2022-05-17',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 71,
      y: 0.8615187586650901,
      originXData: '2022-05-18',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 72,
      y: 0.126354125202296,
      originXData: '2022-05-19',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 73,
      y: 0.7098481312166951,
      originXData: '2022-05-20',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 74,
      y: 17.706030110118455,
      originXData: '2022-05-21',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 75,
      y: 0.9176470910577301,
      originXData: '2022-05-22',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 76,
      y: 16.47452431770853,
      originXData: '2022-05-23',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 77,
      y: 0.7854768368577231,
      originXData: '2022-05-24',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 78,
      y: 34.373177238596014,
      originXData: '2022-05-25',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 79,
      y: 0.789535076533531,
      originXData: '2022-05-26',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 80,
      y: 0.5312851260232421,
      originXData: '2022-05-27',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 81,
      y: 12.028735185645875,
      originXData: '2022-05-28',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 82,
      y: 1.439873268216485,
      originXData: '2022-05-29',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 83,
      y: 3.827653889831506,
      originXData: '2022-05-30',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 84,
      y: 1.4295696272440521,
      originXData: '2022-05-31',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 85,
      y: 1.325995589464272,
      originXData: '2022-06-01',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 86,
      y: 0.627748977148721,
      originXData: '2022-06-02',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 87,
      y: 0.83151391784571,
      originXData: '2022-06-03',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 88,
      y: 0.011530713721830002,
      originXData: '2022-06-04',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 89,
      y: 1.130871471288951,
      originXData: '2022-06-05',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 90,
      y: 2.9958102236757282,
      originXData: '2022-06-06',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 91,
      y: 0.44026116440941004,
      originXData: '2022-06-07',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 92,
      y: 4.156128784010092,
      originXData: '2022-06-08',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 93,
      y: 1.2828566287818242,
      originXData: '2022-06-09',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 94,
      y: 0.23152297348937,
      originXData: '2022-06-10',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 95,
      y: 1.344093064443273,
      originXData: '2022-06-11',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 96,
      y: 0.42108731154009404,
      originXData: '2022-06-12',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 97,
      y: 2.448703044357372,
      originXData: '2022-06-13',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 98,
      y: 1.912454128957958,
      originXData: '2022-06-14',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 99,
      y: 0.010368540480550002,
      originXData: '2022-06-15',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 100,
      y: 0.6677966564200211,
      originXData: '2022-06-16',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 101,
      y: 0.11111864432229301,
      originXData: '2022-06-17',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 102,
      y: 0.806546956486733,
      originXData: '2022-06-18',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 103,
      y: 1.135192118212662,
      originXData: '2022-06-19',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 104,
      y: 1.045144309632654,
      originXData: '2022-06-20',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 105,
      y: 1.076475248295982,
      originXData: '2022-06-21',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 106,
      y: 24.02021682920061,
      originXData: '2022-06-22',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 107,
      y: 0.027051327125384002,
      originXData: '2022-06-23',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 108,
      y: 2.878601660092219,
      originXData: '2022-06-24',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 109,
      y: 0.019465090936308,
      originXData: '2022-06-25',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 110,
      y: 1.2557471231721191,
      originXData: '2022-06-26',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 111,
      y: 0.5849212901405391,
      originXData: '2022-06-27',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 112,
      y: 0.280224773927022,
      originXData: '2022-06-28',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 113,
      y: 0.751739223993092,
      originXData: '2022-06-29',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 114,
      y: 0.555444809676618,
      originXData: '2022-06-30',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 115,
      y: 1.043273887199711,
      originXData: '2022-07-01',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 116,
      y: 1.8724388596735242,
      originXData: '2022-07-02',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 117,
      y: 1.204834846410795,
      originXData: '2022-07-03',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 118,
      y: 0.147183599628016,
      originXData: '2022-07-04',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 119,
      y: 0.259954349350673,
      originXData: '2022-07-05',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 120,
      y: 2.071271452074246,
      originXData: '2022-07-06',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 121,
      y: 0.186466306558064,
      originXData: '2022-07-07',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 122,
      y: 7.997827905255312,
      originXData: '2022-07-08',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 123,
      y: 0.33362085354833704,
      originXData: '2022-07-09',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 124,
      y: 36.550441521853145,
      originXData: '2022-07-10',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 125,
      y: 0.337559642243531,
      originXData: '2022-07-11',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 126,
      y: 0.48307852351030106,
      originXData: '2022-07-12',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 127,
      y: 0.9387594299650791,
      originXData: '2022-07-13',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 128,
      y: 22.940238837323303,
      originXData: '2022-07-14',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 129,
      y: 0.631304013521069,
      originXData: '2022-07-15',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 130,
      y: 0.984028805544615,
      originXData: '2022-07-16',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 131,
      y: 0.26284189122074103,
      originXData: '2022-07-17',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 132,
      y: 1.082826448671828,
      originXData: '2022-07-18',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 133,
      y: 0.5880718113215341,
      originXData: '2022-07-19',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 134,
      y: 0.17041520446782002,
      originXData: '2022-07-20',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 135,
      y: 0.822598941600809,
      originXData: '2022-07-21',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 136,
      y: 0.183634003906628,
      originXData: '2022-07-22',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 137,
      y: 0.559247300094862,
      originXData: '2022-07-23',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 138,
      y: 1.091835974661574,
      originXData: '2022-07-24',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 139,
      y: 3.048531280160542,
      originXData: '2022-07-25',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 140,
      y: 1.582638082613582,
      originXData: '2022-07-26',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 141,
      y: 6.436173309221049,
      originXData: '2022-07-27',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 142,
      y: 1.428578028660132,
      originXData: '2022-07-28',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 143,
      y: 0.7249411790805861,
      originXData: '2022-07-29',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 144,
      y: 0.9265499876312321,
      originXData: '2022-07-30',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 145,
      y: 0.9014047551998651,
      originXData: '2022-07-31',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 146,
      y: 1.610068186750942,
      originXData: '2022-08-01',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 147,
      y: 2.330031081649702,
      originXData: '2022-08-02',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 148,
      y: 0.462815961543229,
      originXData: '2022-08-03',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 149,
      y: 0.08597037675761801,
      originXData: '2022-08-04',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 150,
      y: 3.581243043200601,
      originXData: '2022-08-05',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 151,
      y: 10.930286916614767,
      originXData: '2022-08-06',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 152,
      y: 1.8029857915415932,
      originXData: '2022-08-07',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 153,
      y: 2.014631665755229,
      originXData: '2022-08-08',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 154,
      y: 2.983415297830412,
      originXData: '2022-08-09',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 155,
      y: 1.289582374551249,
      originXData: '2022-08-10',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 156,
      y: 0.37516694909806303,
      originXData: '2022-08-11',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 157,
      y: 1.603259620438238,
      originXData: '2022-08-12',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 158,
      y: 3.3791466219930433,
      originXData: '2022-08-13',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 159,
      y: 2.627126072551769,
      originXData: '2022-08-14',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 160,
      y: 3.354483317899366,
      originXData: '2022-08-15',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 161,
      y: 1.444879535922397,
      originXData: '2022-08-16',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 162,
      y: 0.6369673400603011,
      originXData: '2022-08-17',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 163,
      y: 0.5990722583580821,
      originXData: '2022-08-18',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 164,
      y: 0.24079634787311602,
      originXData: '2022-08-19',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 165,
      y: 0.096627004274573,
      originXData: '2022-08-20',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 166,
      y: 11.782408392531364,
      originXData: '2022-08-21',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 167,
      y: 1.846139752930779,
      originXData: '2022-08-22',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 168,
      y: 2.44670175499675,
      originXData: '2022-08-23',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 169,
      y: 9.285256494681935,
      originXData: '2022-08-24',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 170,
      y: 40.63547963350666,
      originXData: '2022-08-25',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 171,
      y: 1.432898057334553,
      originXData: '2022-08-26',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 172,
      y: 1.140228551443707,
      originXData: '2022-08-27',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 173,
      y: 0.37561791103581305,
      originXData: '2022-08-28',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 174,
      y: 1.203078886727172,
      originXData: '2022-08-29',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 175,
      y: 0.901524977902984,
      originXData: '2022-08-30',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 176,
      y: 0.22721632248943202,
      originXData: '2022-08-31',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 177,
      y: 2.040817156148029,
      originXData: '2022-09-01',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 178,
      y: 0.071469482611002,
      originXData: '2022-09-02',
      type: 'Engagement - Socialization \n\n'
    },
    {
      x: 179,
      y: 1.903668070163285,
      originXData: '2022-09-03',
      type: 'Engagement - Socialization \n\n'
    }
  ],
  'Penetration of Private Messages': [
    {
      x: 0,
      y: 0.21493020207806002,
      originXData: '2022-03-08',
      type: 'Penetration of Private Messages'
    },
    {
      x: 1,
      y: 0.31807068769079905,
      originXData: '2022-03-09',
      type: 'Penetration of Private Messages'
    },
    {
      x: 2,
      y: 0.9774597853017851,
      originXData: '2022-03-10',
      type: 'Penetration of Private Messages'
    },
    {
      x: 3,
      y: 0.662196540154462,
      originXData: '2022-03-11',
      type: 'Penetration of Private Messages'
    },
    {
      x: 4,
      y: 1.547704220622789,
      originXData: '2022-03-12',
      type: 'Penetration of Private Messages'
    },
    {
      x: 5,
      y: 0.52384329811226,
      originXData: '2022-03-13',
      type: 'Penetration of Private Messages'
    },
    {
      x: 6,
      y: 1.242674929077965,
      originXData: '2022-03-14',
      type: 'Penetration of Private Messages'
    },
    {
      x: 7,
      y: 1.133076821811672,
      originXData: '2022-03-15',
      type: 'Penetration of Private Messages'
    },
    {
      x: 8,
      y: 1.261446251860683,
      originXData: '2022-03-16',
      type: 'Penetration of Private Messages'
    },
    {
      x: 9,
      y: 0.908573021920086,
      originXData: '2022-03-17',
      type: 'Penetration of Private Messages'
    },
    {
      x: 10,
      y: 2.003638269088651,
      originXData: '2022-03-18',
      type: 'Penetration of Private Messages'
    },
    {
      x: 11,
      y: 1.285574252451237,
      originXData: '2022-03-19',
      type: 'Penetration of Private Messages'
    },
    {
      x: 12,
      y: 1.683935730207101,
      originXData: '2022-03-20',
      type: 'Penetration of Private Messages'
    },
    {
      x: 13,
      y: 0.518960506573594,
      originXData: '2022-03-21',
      type: 'Penetration of Private Messages'
    },
    {
      x: 14,
      y: 2.076490748024919,
      originXData: '2022-03-22',
      type: 'Penetration of Private Messages'
    },
    {
      x: 15,
      y: 31.918470633985613,
      originXData: '2022-03-23',
      type: 'Penetration of Private Messages'
    },
    {
      x: 16,
      y: 1.735738814795219,
      originXData: '2022-03-24',
      type: 'Penetration of Private Messages'
    },
    {
      x: 17,
      y: 1.072942910906809,
      originXData: '2022-03-25',
      type: 'Penetration of Private Messages'
    },
    {
      x: 18,
      y: 10.31725741409195,
      originXData: '2022-03-26',
      type: 'Penetration of Private Messages'
    },
    {
      x: 19,
      y: 1.288157916081268,
      originXData: '2022-03-27',
      type: 'Penetration of Private Messages'
    },
    {
      x: 20,
      y: 0.24488975421611903,
      originXData: '2022-03-28',
      type: 'Penetration of Private Messages'
    },
    {
      x: 21,
      y: 3.030888929145336,
      originXData: '2022-03-29',
      type: 'Penetration of Private Messages'
    },
    {
      x: 22,
      y: 1.4304534277803231,
      originXData: '2022-03-30',
      type: 'Penetration of Private Messages'
    },
    {
      x: 23,
      y: 1.32475784490384,
      originXData: '2022-03-31',
      type: 'Penetration of Private Messages'
    },
    {
      x: 24,
      y: 0.9289553576582981,
      originXData: '2022-04-01',
      type: 'Penetration of Private Messages'
    },
    {
      x: 25,
      y: 0.8470948142995741,
      originXData: '2022-04-02',
      type: 'Penetration of Private Messages'
    },
    {
      x: 26,
      y: 0.5908683646183901,
      originXData: '2022-04-03',
      type: 'Penetration of Private Messages'
    },
    {
      x: 27,
      y: 1.006103497118929,
      originXData: '2022-04-04',
      type: 'Penetration of Private Messages'
    },
    {
      x: 28,
      y: 13.880860231019398,
      originXData: '2022-04-05',
      type: 'Penetration of Private Messages'
    },
    {
      x: 29,
      y: 7.121018094960213,
      originXData: '2022-04-06',
      type: 'Penetration of Private Messages'
    },
    {
      x: 30,
      y: 2.010136943230478,
      originXData: '2022-04-07',
      type: 'Penetration of Private Messages'
    },
    {
      x: 31,
      y: 14.457401852798982,
      originXData: '2022-04-08',
      type: 'Penetration of Private Messages'
    },
    {
      x: 32,
      y: 0.9593788300193951,
      originXData: '2022-04-09',
      type: 'Penetration of Private Messages'
    },
    {
      x: 33,
      y: 1.138776207683746,
      originXData: '2022-04-10',
      type: 'Penetration of Private Messages'
    },
    {
      x: 34,
      y: 0.575680679073131,
      originXData: '2022-04-11',
      type: 'Penetration of Private Messages'
    },
    {
      x: 35,
      y: 2.90160000840929,
      originXData: '2022-04-12',
      type: 'Penetration of Private Messages'
    },
    {
      x: 36,
      y: 1.416876192652653,
      originXData: '2022-04-13',
      type: 'Penetration of Private Messages'
    },
    {
      x: 37,
      y: 0.034172330313952004,
      originXData: '2022-04-14',
      type: 'Penetration of Private Messages'
    },
    {
      x: 38,
      y: 3.745099757241069,
      originXData: '2022-04-15',
      type: 'Penetration of Private Messages'
    },
    {
      x: 39,
      y: 6.202762040985617,
      originXData: '2022-04-16',
      type: 'Penetration of Private Messages'
    },
    {
      x: 40,
      y: 0.6882380919620981,
      originXData: '2022-04-17',
      type: 'Penetration of Private Messages'
    },
    {
      x: 41,
      y: 0.07904084882979401,
      originXData: '2022-04-18',
      type: 'Penetration of Private Messages'
    },
    {
      x: 42,
      y: 0.013117573233606001,
      originXData: '2022-04-19',
      type: 'Penetration of Private Messages'
    },
    {
      x: 43,
      y: 3.143179675624189,
      originXData: '2022-04-20',
      type: 'Penetration of Private Messages'
    },
    {
      x: 44,
      y: 0.6180860661837431,
      originXData: '2022-04-21',
      type: 'Penetration of Private Messages'
    },
    {
      x: 45,
      y: 0.001536382167654,
      originXData: '2022-04-22',
      type: 'Penetration of Private Messages'
    },
    {
      x: 46,
      y: 0.27081187550692803,
      originXData: '2022-04-23',
      type: 'Penetration of Private Messages'
    },
    {
      x: 47,
      y: 0.7774852739576821,
      originXData: '2022-04-24',
      type: 'Penetration of Private Messages'
    },
    {
      x: 48,
      y: 0.859959904015784,
      originXData: '2022-04-25',
      type: 'Penetration of Private Messages'
    },
    {
      x: 49,
      y: 0.22244045641286703,
      originXData: '2022-04-26',
      type: 'Penetration of Private Messages'
    },
    {
      x: 50,
      y: 0.509144429951741,
      originXData: '2022-04-27',
      type: 'Penetration of Private Messages'
    },
    {
      x: 51,
      y: 0.13894846116144902,
      originXData: '2022-04-28',
      type: 'Penetration of Private Messages'
    },
    {
      x: 52,
      y: 0.19686640023465302,
      originXData: '2022-04-29',
      type: 'Penetration of Private Messages'
    },
    {
      x: 53,
      y: 2.931184732430775,
      originXData: '2022-04-30',
      type: 'Penetration of Private Messages'
    },
    {
      x: 54,
      y: 0.544054544143018,
      originXData: '2022-05-01',
      type: 'Penetration of Private Messages'
    },
    {
      x: 55,
      y: 10.530894431942714,
      originXData: '2022-05-02',
      type: 'Penetration of Private Messages'
    },
    {
      x: 56,
      y: 4.483541728043783,
      originXData: '2022-05-03',
      type: 'Penetration of Private Messages'
    },
    {
      x: 57,
      y: 8.400221891051206,
      originXData: '2022-05-04',
      type: 'Penetration of Private Messages'
    },
    {
      x: 58,
      y: 0.6862921980279431,
      originXData: '2022-05-05',
      type: 'Penetration of Private Messages'
    },
    {
      x: 59,
      y: 4.557825514906153,
      originXData: '2022-05-06',
      type: 'Penetration of Private Messages'
    },
    {
      x: 60,
      y: 0.527497153125138,
      originXData: '2022-05-07',
      type: 'Penetration of Private Messages'
    },
    {
      x: 61,
      y: 1.25226701190186,
      originXData: '2022-05-08',
      type: 'Penetration of Private Messages'
    },
    {
      x: 62,
      y: 0.643077700672811,
      originXData: '2022-05-09',
      type: 'Penetration of Private Messages'
    },
    {
      x: 63,
      y: 0.031193331319320002,
      originXData: '2022-05-10',
      type: 'Penetration of Private Messages'
    },
    {
      x: 64,
      y: 0.39325414355653304,
      originXData: '2022-05-11',
      type: 'Penetration of Private Messages'
    },
    {
      x: 65,
      y: 0.863652647240271,
      originXData: '2022-05-12',
      type: 'Penetration of Private Messages'
    },
    {
      x: 66,
      y: 0.65309749602536,
      originXData: '2022-05-13',
      type: 'Penetration of Private Messages'
    },
    {
      x: 67,
      y: 0.502507081730036,
      originXData: '2022-05-14',
      type: 'Penetration of Private Messages'
    },
    {
      x: 68,
      y: 1.989727381483406,
      originXData: '2022-05-15',
      type: 'Penetration of Private Messages'
    },
    {
      x: 69,
      y: 0.747391405264186,
      originXData: '2022-05-16',
      type: 'Penetration of Private Messages'
    },
    {
      x: 70,
      y: 0.901758308356248,
      originXData: '2022-05-17',
      type: 'Penetration of Private Messages'
    },
    {
      x: 71,
      y: 0.43634054682577406,
      originXData: '2022-05-18',
      type: 'Penetration of Private Messages'
    },
    {
      x: 72,
      y: 2.8539304550226543,
      originXData: '2022-05-19',
      type: 'Penetration of Private Messages'
    },
    {
      x: 73,
      y: 0.5071020864029481,
      originXData: '2022-05-20',
      type: 'Penetration of Private Messages'
    },
    {
      x: 74,
      y: 2.848137759152337,
      originXData: '2022-05-21',
      type: 'Penetration of Private Messages'
    },
    {
      x: 75,
      y: 0.43003615544265306,
      originXData: '2022-05-22',
      type: 'Penetration of Private Messages'
    },
    {
      x: 76,
      y: 2.744192036280677,
      originXData: '2022-05-23',
      type: 'Penetration of Private Messages'
    },
    {
      x: 77,
      y: 0.6263662592501831,
      originXData: '2022-05-24',
      type: 'Penetration of Private Messages'
    },
    {
      x: 78,
      y: 7.564216276703391,
      originXData: '2022-05-25',
      type: 'Penetration of Private Messages'
    },
    {
      x: 79,
      y: 0.8798790088553111,
      originXData: '2022-05-26',
      type: 'Penetration of Private Messages'
    },
    {
      x: 80,
      y: 1.055373428020675,
      originXData: '2022-05-27',
      type: 'Penetration of Private Messages'
    },
    {
      x: 81,
      y: 14.171624745847268,
      originXData: '2022-05-28',
      type: 'Penetration of Private Messages'
    },
    {
      x: 82,
      y: 1.078931580631559,
      originXData: '2022-05-29',
      type: 'Penetration of Private Messages'
    },
    {
      x: 83,
      y: 1.429842282923971,
      originXData: '2022-05-30',
      type: 'Penetration of Private Messages'
    },
    {
      x: 84,
      y: 1.141933003322777,
      originXData: '2022-05-31',
      type: 'Penetration of Private Messages'
    },
    {
      x: 85,
      y: 2.006909504383298,
      originXData: '2022-06-01',
      type: 'Penetration of Private Messages'
    },
    {
      x: 86,
      y: 1.176985400742372,
      originXData: '2022-06-02',
      type: 'Penetration of Private Messages'
    },
    {
      x: 87,
      y: 1.356692075891955,
      originXData: '2022-06-03',
      type: 'Penetration of Private Messages'
    },
    {
      x: 88,
      y: 0.52485737802621,
      originXData: '2022-06-04',
      type: 'Penetration of Private Messages'
    },
    {
      x: 89,
      y: 1.189107233207374,
      originXData: '2022-06-05',
      type: 'Penetration of Private Messages'
    },
    {
      x: 90,
      y: 0.47619309340284505,
      originXData: '2022-06-06',
      type: 'Penetration of Private Messages'
    },
    {
      x: 91,
      y: 0.42982954277120905,
      originXData: '2022-06-07',
      type: 'Penetration of Private Messages'
    },
    {
      x: 92,
      y: 1.021512025143279,
      originXData: '2022-06-08',
      type: 'Penetration of Private Messages'
    },
    {
      x: 93,
      y: 0.22198861960947303,
      originXData: '2022-06-09',
      type: 'Penetration of Private Messages'
    },
    {
      x: 94,
      y: 0.18500236928827601,
      originXData: '2022-06-10',
      type: 'Penetration of Private Messages'
    },
    {
      x: 95,
      y: 0.6923204827335401,
      originXData: '2022-06-11',
      type: 'Penetration of Private Messages'
    },
    {
      x: 96,
      y: 1.547163500435265,
      originXData: '2022-06-12',
      type: 'Penetration of Private Messages'
    },
    {
      x: 97,
      y: 0.13900479867391702,
      originXData: '2022-06-13',
      type: 'Penetration of Private Messages'
    },
    {
      x: 98,
      y: 0.24702549770442003,
      originXData: '2022-06-14',
      type: 'Penetration of Private Messages'
    },
    {
      x: 99,
      y: 0.133167401519793,
      originXData: '2022-06-15',
      type: 'Penetration of Private Messages'
    },
    {
      x: 100,
      y: 4.009094569074379,
      originXData: '2022-06-16',
      type: 'Penetration of Private Messages'
    },
    {
      x: 101,
      y: 0.9730098334869651,
      originXData: '2022-06-17',
      type: 'Penetration of Private Messages'
    },
    {
      x: 102,
      y: 0.32013564834811403,
      originXData: '2022-06-18',
      type: 'Penetration of Private Messages'
    },
    {
      x: 103,
      y: 5.021267051723119,
      originXData: '2022-06-19',
      type: 'Penetration of Private Messages'
    },
    {
      x: 104,
      y: 4.014478741193049,
      originXData: '2022-06-20',
      type: 'Penetration of Private Messages'
    },
    {
      x: 105,
      y: 0.7240389412682761,
      originXData: '2022-06-21',
      type: 'Penetration of Private Messages'
    },
    {
      x: 106,
      y: 37.05462241129788,
      originXData: '2022-06-22',
      type: 'Penetration of Private Messages'
    },
    {
      x: 107,
      y: 0.16824850993617801,
      originXData: '2022-06-23',
      type: 'Penetration of Private Messages'
    },
    {
      x: 108,
      y: 1.9317197675603461,
      originXData: '2022-06-24',
      type: 'Penetration of Private Messages'
    },
    {
      x: 109,
      y: 0.285177476177572,
      originXData: '2022-06-25',
      type: 'Penetration of Private Messages'
    },
    {
      x: 110,
      y: 1.260075716991639,
      originXData: '2022-06-26',
      type: 'Penetration of Private Messages'
    },
    {
      x: 111,
      y: 3.452510757244162,
      originXData: '2022-06-27',
      type: 'Penetration of Private Messages'
    },
    {
      x: 112,
      y: 0.729523367081325,
      originXData: '2022-06-28',
      type: 'Penetration of Private Messages'
    },
    {
      x: 113,
      y: 0.7538963415227941,
      originXData: '2022-06-29',
      type: 'Penetration of Private Messages'
    },
    {
      x: 114,
      y: 0.08646395240381301,
      originXData: '2022-06-30',
      type: 'Penetration of Private Messages'
    },
    {
      x: 115,
      y: 0.49779032149353303,
      originXData: '2022-07-01',
      type: 'Penetration of Private Messages'
    },
    {
      x: 116,
      y: 0.391981409036455,
      originXData: '2022-07-02',
      type: 'Penetration of Private Messages'
    },
    {
      x: 117,
      y: 1.103562611606201,
      originXData: '2022-07-03',
      type: 'Penetration of Private Messages'
    },
    {
      x: 118,
      y: 1.798064276315111,
      originXData: '2022-07-04',
      type: 'Penetration of Private Messages'
    },
    {
      x: 119,
      y: 0.407469349519874,
      originXData: '2022-07-05',
      type: 'Penetration of Private Messages'
    },
    {
      x: 120,
      y: 4.502139668053687,
      originXData: '2022-07-06',
      type: 'Penetration of Private Messages'
    },
    {
      x: 121,
      y: 0.499133613586184,
      originXData: '2022-07-07',
      type: 'Penetration of Private Messages'
    },
    {
      x: 122,
      y: 5.845195208267132,
      originXData: '2022-07-08',
      type: 'Penetration of Private Messages'
    },
    {
      x: 123,
      y: 1.26505092951483,
      originXData: '2022-07-09',
      type: 'Penetration of Private Messages'
    },
    {
      x: 124,
      y: 19.095991246701065,
      originXData: '2022-07-10',
      type: 'Penetration of Private Messages'
    },
    {
      x: 125,
      y: 1.154651513638781,
      originXData: '2022-07-11',
      type: 'Penetration of Private Messages'
    },
    {
      x: 126,
      y: 1.5365158530965122,
      originXData: '2022-07-12',
      type: 'Penetration of Private Messages'
    },
    {
      x: 127,
      y: 1.092431878065284,
      originXData: '2022-07-13',
      type: 'Penetration of Private Messages'
    },
    {
      x: 128,
      y: 13.579325095732914,
      originXData: '2022-07-14',
      type: 'Penetration of Private Messages'
    },
    {
      x: 129,
      y: 0.62869350368483,
      originXData: '2022-07-15',
      type: 'Penetration of Private Messages'
    },
    {
      x: 130,
      y: 0.967817534607272,
      originXData: '2022-07-16',
      type: 'Penetration of Private Messages'
    },
    {
      x: 131,
      y: 2.154865858339681,
      originXData: '2022-07-17',
      type: 'Penetration of Private Messages'
    },
    {
      x: 132,
      y: 0.45266260254768803,
      originXData: '2022-07-18',
      type: 'Penetration of Private Messages'
    },
    {
      x: 133,
      y: 1.007179376918947,
      originXData: '2022-07-19',
      type: 'Penetration of Private Messages'
    },
    {
      x: 134,
      y: 1.773905435681336,
      originXData: '2022-07-20',
      type: 'Penetration of Private Messages'
    },
    {
      x: 135,
      y: 0.9593067917284711,
      originXData: '2022-07-21',
      type: 'Penetration of Private Messages'
    },
    {
      x: 136,
      y: 13.34157103707886,
      originXData: '2022-07-22',
      type: 'Penetration of Private Messages'
    },
    {
      x: 137,
      y: 0.40653075149155804,
      originXData: '2022-07-23',
      type: 'Penetration of Private Messages'
    },
    {
      x: 138,
      y: 0.8199135063617131,
      originXData: '2022-07-24',
      type: 'Penetration of Private Messages'
    },
    {
      x: 139,
      y: 1.471231045142114,
      originXData: '2022-07-25',
      type: 'Penetration of Private Messages'
    },
    {
      x: 140,
      y: 1.789945856913414,
      originXData: '2022-07-26',
      type: 'Penetration of Private Messages'
    },
    {
      x: 141,
      y: 4.7854634352690155,
      originXData: '2022-07-27',
      type: 'Penetration of Private Messages'
    },
    {
      x: 142,
      y: 1.458686942176205,
      originXData: '2022-07-28',
      type: 'Penetration of Private Messages'
    },
    {
      x: 143,
      y: 0.42039676295059203,
      originXData: '2022-07-29',
      type: 'Penetration of Private Messages'
    },
    {
      x: 144,
      y: 0.32494629315872703,
      originXData: '2022-07-30',
      type: 'Penetration of Private Messages'
    },
    {
      x: 145,
      y: 0.46982772647431204,
      originXData: '2022-07-31',
      type: 'Penetration of Private Messages'
    },
    {
      x: 146,
      y: 3.309159861747862,
      originXData: '2022-08-01',
      type: 'Penetration of Private Messages'
    },
    {
      x: 147,
      y: 3.9640154638953513,
      originXData: '2022-08-02',
      type: 'Penetration of Private Messages'
    },
    {
      x: 148,
      y: 0.9670138622828691,
      originXData: '2022-08-03',
      type: 'Penetration of Private Messages'
    },
    {
      x: 149,
      y: 0.9707805498085981,
      originXData: '2022-08-04',
      type: 'Penetration of Private Messages'
    },
    {
      x: 150,
      y: 2.651870015387795,
      originXData: '2022-08-05',
      type: 'Penetration of Private Messages'
    },
    {
      x: 151,
      y: 22.78182877052594,
      originXData: '2022-08-06',
      type: 'Penetration of Private Messages'
    },
    {
      x: 152,
      y: 1.476317514220094,
      originXData: '2022-08-07',
      type: 'Penetration of Private Messages'
    },
    {
      x: 153,
      y: 2.7977280500624433,
      originXData: '2022-08-08',
      type: 'Penetration of Private Messages'
    },
    {
      x: 154,
      y: 0.126105493389976,
      originXData: '2022-08-09',
      type: 'Penetration of Private Messages'
    },
    {
      x: 155,
      y: 2.5475660513369442,
      originXData: '2022-08-10',
      type: 'Penetration of Private Messages'
    },
    {
      x: 156,
      y: 0.5828588359439041,
      originXData: '2022-08-11',
      type: 'Penetration of Private Messages'
    },
    {
      x: 157,
      y: 1.8751590471743,
      originXData: '2022-08-12',
      type: 'Penetration of Private Messages'
    },
    {
      x: 158,
      y: 9.375119750363103,
      originXData: '2022-08-13',
      type: 'Penetration of Private Messages'
    },
    {
      x: 159,
      y: 0.57102589263998,
      originXData: '2022-08-14',
      type: 'Penetration of Private Messages'
    },
    {
      x: 160,
      y: 1.075590808840468,
      originXData: '2022-08-15',
      type: 'Penetration of Private Messages'
    },
    {
      x: 161,
      y: 0.942851527789979,
      originXData: '2022-08-16',
      type: 'Penetration of Private Messages'
    },
    {
      x: 162,
      y: 0.473080126014195,
      originXData: '2022-08-17',
      type: 'Penetration of Private Messages'
    },
    {
      x: 163,
      y: 0.911179769434693,
      originXData: '2022-08-18',
      type: 'Penetration of Private Messages'
    },
    {
      x: 164,
      y: 0.045592515857608006,
      originXData: '2022-08-19',
      type: 'Penetration of Private Messages'
    },
    {
      x: 165,
      y: 0.7910843611370051,
      originXData: '2022-08-20',
      type: 'Penetration of Private Messages'
    },
    {
      x: 166,
      y: 4.022381962144387,
      originXData: '2022-08-21',
      type: 'Penetration of Private Messages'
    },
    {
      x: 167,
      y: 1.302218066447416,
      originXData: '2022-08-22',
      type: 'Penetration of Private Messages'
    },
    {
      x: 168,
      y: 2.701336009126233,
      originXData: '2022-08-23',
      type: 'Penetration of Private Messages'
    },
    {
      x: 169,
      y: 14.17816605948454,
      originXData: '2022-08-24',
      type: 'Penetration of Private Messages'
    },
    {
      x: 170,
      y: 52.36627420733006,
      originXData: '2022-08-25',
      type: 'Penetration of Private Messages'
    },
    {
      x: 171,
      y: 0.500652317272802,
      originXData: '2022-08-26',
      type: 'Penetration of Private Messages'
    },
    {
      x: 172,
      y: 2.535947091285437,
      originXData: '2022-08-27',
      type: 'Penetration of Private Messages'
    },
    {
      x: 173,
      y: 1.087399555743408,
      originXData: '2022-08-28',
      type: 'Penetration of Private Messages'
    },
    {
      x: 174,
      y: 0.8966719923838661,
      originXData: '2022-08-29',
      type: 'Penetration of Private Messages'
    },
    {
      x: 175,
      y: 0.9660257636136701,
      originXData: '2022-08-30',
      type: 'Penetration of Private Messages'
    },
    {
      x: 176,
      y: 0.9247009404760361,
      originXData: '2022-08-31',
      type: 'Penetration of Private Messages'
    },
    {
      x: 177,
      y: 2.19857288799284,
      originXData: '2022-09-01',
      type: 'Penetration of Private Messages'
    },
    {
      x: 178,
      y: 0.9048807067534731,
      originXData: '2022-09-02',
      type: 'Penetration of Private Messages'
    },
    {
      x: 179,
      y: 1.866568462888393,
      originXData: '2022-09-03',
      type: 'Penetration of Private Messages'
    }
  ],
  'Number of Private Messages per User': [
    {
      x: 0,
      y: 0.26002007727513005,
      originXData: '2022-03-08',
      type: 'Number of Private Messages per User'
    },
    {
      x: 1,
      y: 1.791161354352144,
      originXData: '2022-03-09',
      type: 'Number of Private Messages per User'
    },
    {
      x: 2,
      y: 1.410289280738493,
      originXData: '2022-03-10',
      type: 'Number of Private Messages per User'
    },
    {
      x: 3,
      y: 2.374084690062705,
      originXData: '2022-03-11',
      type: 'Number of Private Messages per User'
    },
    {
      x: 4,
      y: 0.42545370377775604,
      originXData: '2022-03-12',
      type: 'Number of Private Messages per User'
    },
    {
      x: 5,
      y: 0.45119753243186805,
      originXData: '2022-03-13',
      type: 'Number of Private Messages per User'
    },
    {
      x: 6,
      y: 1.276345431333586,
      originXData: '2022-03-14',
      type: 'Number of Private Messages per User'
    },
    {
      x: 7,
      y: 0.22045142924559902,
      originXData: '2022-03-15',
      type: 'Number of Private Messages per User'
    },
    {
      x: 8,
      y: 0.061775812702848,
      originXData: '2022-03-16',
      type: 'Number of Private Messages per User'
    },
    {
      x: 9,
      y: 0.429194248082692,
      originXData: '2022-03-17',
      type: 'Number of Private Messages per User'
    },
    {
      x: 10,
      y: 1.194511111230195,
      originXData: '2022-03-18',
      type: 'Number of Private Messages per User'
    },
    {
      x: 11,
      y: 0.659056833995271,
      originXData: '2022-03-19',
      type: 'Number of Private Messages per User'
    },
    {
      x: 12,
      y: 0.40361011204949004,
      originXData: '2022-03-20',
      type: 'Number of Private Messages per User'
    },
    {
      x: 13,
      y: 0.8441533797310441,
      originXData: '2022-03-21',
      type: 'Number of Private Messages per User'
    },
    {
      x: 14,
      y: 1.8682050366367142,
      originXData: '2022-03-22',
      type: 'Number of Private Messages per User'
    },
    {
      x: 15,
      y: 70.34237647545662,
      originXData: '2022-03-23',
      type: 'Number of Private Messages per User'
    },
    {
      x: 16,
      y: 3.854924132202267,
      originXData: '2022-03-24',
      type: 'Number of Private Messages per User'
    },
    {
      x: 17,
      y: 0.868965201778456,
      originXData: '2022-03-25',
      type: 'Number of Private Messages per User'
    },
    {
      x: 18,
      y: 0.6724835487477681,
      originXData: '2022-03-26',
      type: 'Number of Private Messages per User'
    },
    {
      x: 19,
      y: 1.290710012048575,
      originXData: '2022-03-27',
      type: 'Number of Private Messages per User'
    },
    {
      x: 20,
      y: 0.944202324553962,
      originXData: '2022-03-28',
      type: 'Number of Private Messages per User'
    },
    {
      x: 21,
      y: 2.191548298261417,
      originXData: '2022-03-29',
      type: 'Number of Private Messages per User'
    },
    {
      x: 22,
      y: 0.9398051933719991,
      originXData: '2022-03-30',
      type: 'Number of Private Messages per User'
    },
    {
      x: 23,
      y: 0.212383798504713,
      originXData: '2022-03-31',
      type: 'Number of Private Messages per User'
    },
    {
      x: 24,
      y: 1.328758303758777,
      originXData: '2022-04-01',
      type: 'Number of Private Messages per User'
    },
    {
      x: 25,
      y: 1.061518688804395,
      originXData: '2022-04-02',
      type: 'Number of Private Messages per User'
    },
    {
      x: 26,
      y: 1.021428732507816,
      originXData: '2022-04-03',
      type: 'Number of Private Messages per User'
    },
    {
      x: 27,
      y: 0.8496566144677861,
      originXData: '2022-04-04',
      type: 'Number of Private Messages per User'
    },
    {
      x: 28,
      y: 19.78289952089912,
      originXData: '2022-04-05',
      type: 'Number of Private Messages per User'
    },
    {
      x: 29,
      y: 0.032847589287524,
      originXData: '2022-04-06',
      type: 'Number of Private Messages per User'
    },
    {
      x: 30,
      y: 2.758258304057329,
      originXData: '2022-04-07',
      type: 'Number of Private Messages per User'
    },
    {
      x: 31,
      y: 11.6964360828172,
      originXData: '2022-04-08',
      type: 'Number of Private Messages per User'
    },
    {
      x: 32,
      y: 1.121066838670219,
      originXData: '2022-04-09',
      type: 'Number of Private Messages per User'
    },
    {
      x: 33,
      y: 0.5694312841615821,
      originXData: '2022-04-10',
      type: 'Number of Private Messages per User'
    },
    {
      x: 34,
      y: 0.502679162912634,
      originXData: '2022-04-11',
      type: 'Number of Private Messages per User'
    },
    {
      x: 35,
      y: 3.084080663501847,
      originXData: '2022-04-12',
      type: 'Number of Private Messages per User'
    },
    {
      x: 36,
      y: 0.270647644667579,
      originXData: '2022-04-13',
      type: 'Number of Private Messages per User'
    },
    {
      x: 37,
      y: 0.268470350264293,
      originXData: '2022-04-14',
      type: 'Number of Private Messages per User'
    },
    {
      x: 38,
      y: 2.612195295941399,
      originXData: '2022-04-15',
      type: 'Number of Private Messages per User'
    },
    {
      x: 39,
      y: 18.098567324029407,
      originXData: '2022-04-16',
      type: 'Number of Private Messages per User'
    },
    {
      x: 40,
      y: 0.645388563624089,
      originXData: '2022-04-17',
      type: 'Number of Private Messages per User'
    },
    {
      x: 41,
      y: 0.16144847919011002,
      originXData: '2022-04-18',
      type: 'Number of Private Messages per User'
    },
    {
      x: 42,
      y: 0.36918835535862005,
      originXData: '2022-04-19',
      type: 'Number of Private Messages per User'
    },
    {
      x: 43,
      y: 5.283666616893828,
      originXData: '2022-04-20',
      type: 'Number of Private Messages per User'
    },
    {
      x: 44,
      y: 1.631115014312209,
      originXData: '2022-04-21',
      type: 'Number of Private Messages per User'
    },
    {
      x: 45,
      y: 0.807551152019862,
      originXData: '2022-04-22',
      type: 'Number of Private Messages per User'
    },
    {
      x: 46,
      y: 0.22998130489182,
      originXData: '2022-04-23',
      type: 'Number of Private Messages per User'
    },
    {
      x: 47,
      y: 1.107108162852159,
      originXData: '2022-04-24',
      type: 'Number of Private Messages per User'
    },
    {
      x: 48,
      y: 0.641738277028276,
      originXData: '2022-04-25',
      type: 'Number of Private Messages per User'
    },
    {
      x: 49,
      y: 1.320954321806144,
      originXData: '2022-04-26',
      type: 'Number of Private Messages per User'
    },
    {
      x: 50,
      y: 0.20073460039620403,
      originXData: '2022-04-27',
      type: 'Number of Private Messages per User'
    },
    {
      x: 51,
      y: 0.7415989059349031,
      originXData: '2022-04-28',
      type: 'Number of Private Messages per User'
    },
    {
      x: 52,
      y: 1.66475441380813,
      originXData: '2022-04-29',
      type: 'Number of Private Messages per User'
    },
    {
      x: 53,
      y: 1.792534569741266,
      originXData: '2022-04-30',
      type: 'Number of Private Messages per User'
    },
    {
      x: 54,
      y: 0.35016352980012605,
      originXData: '2022-05-01',
      type: 'Number of Private Messages per User'
    },
    {
      x: 55,
      y: 4.323328789531124,
      originXData: '2022-05-02',
      type: 'Number of Private Messages per User'
    },
    {
      x: 56,
      y: 3.7796731596206943,
      originXData: '2022-05-03',
      type: 'Number of Private Messages per User'
    },
    {
      x: 57,
      y: 8.018922971992662,
      originXData: '2022-05-04',
      type: 'Number of Private Messages per User'
    },
    {
      x: 58,
      y: 0.44745062012103404,
      originXData: '2022-05-05',
      type: 'Number of Private Messages per User'
    },
    {
      x: 59,
      y: 3.46073691075845,
      originXData: '2022-05-06',
      type: 'Number of Private Messages per User'
    },
    {
      x: 60,
      y: 0.120868915583745,
      originXData: '2022-05-07',
      type: 'Number of Private Messages per User'
    },
    {
      x: 61,
      y: 0.42909048781311704,
      originXData: '2022-05-08',
      type: 'Number of Private Messages per User'
    },
    {
      x: 62,
      y: 0.539461571476962,
      originXData: '2022-05-09',
      type: 'Number of Private Messages per User'
    },
    {
      x: 63,
      y: 0.341612265371036,
      originXData: '2022-05-10',
      type: 'Number of Private Messages per User'
    },
    {
      x: 64,
      y: 0.918926460102595,
      originXData: '2022-05-11',
      type: 'Number of Private Messages per User'
    },
    {
      x: 65,
      y: 1.249717355592488,
      originXData: '2022-05-12',
      type: 'Number of Private Messages per User'
    },
    {
      x: 66,
      y: 1.244646630025216,
      originXData: '2022-05-13',
      type: 'Number of Private Messages per User'
    },
    {
      x: 67,
      y: 0.026734770744615003,
      originXData: '2022-05-14',
      type: 'Number of Private Messages per User'
    },
    {
      x: 68,
      y: 1.510725845099207,
      originXData: '2022-05-15',
      type: 'Number of Private Messages per User'
    },
    {
      x: 69,
      y: 0.283792059973869,
      originXData: '2022-05-16',
      type: 'Number of Private Messages per User'
    },
    {
      x: 70,
      y: 0.41795473321335,
      originXData: '2022-05-17',
      type: 'Number of Private Messages per User'
    },
    {
      x: 71,
      y: 1.895212820019219,
      originXData: '2022-05-18',
      type: 'Number of Private Messages per User'
    },
    {
      x: 72,
      y: 0.77105240170235,
      originXData: '2022-05-19',
      type: 'Number of Private Messages per User'
    },
    {
      x: 73,
      y: 2.543277547025898,
      originXData: '2022-05-20',
      type: 'Number of Private Messages per User'
    },
    {
      x: 74,
      y: 1.260088014509166,
      originXData: '2022-05-21',
      type: 'Number of Private Messages per User'
    },
    {
      x: 75,
      y: 0.910155627802492,
      originXData: '2022-05-22',
      type: 'Number of Private Messages per User'
    },
    {
      x: 76,
      y: 1.124249996351633,
      originXData: '2022-05-23',
      type: 'Number of Private Messages per User'
    },
    {
      x: 77,
      y: 0.19409864063613502,
      originXData: '2022-05-24',
      type: 'Number of Private Messages per User'
    },
    {
      x: 78,
      y: 17.06769270843336,
      originXData: '2022-05-25',
      type: 'Number of Private Messages per User'
    },
    {
      x: 79,
      y: 0.592040366427117,
      originXData: '2022-05-26',
      type: 'Number of Private Messages per User'
    },
    {
      x: 80,
      y: 0.84736634769268,
      originXData: '2022-05-27',
      type: 'Number of Private Messages per User'
    },
    {
      x: 81,
      y: 35.787490090751945,
      originXData: '2022-05-28',
      type: 'Number of Private Messages per User'
    },
    {
      x: 82,
      y: 0.9907508552960291,
      originXData: '2022-05-29',
      type: 'Number of Private Messages per User'
    },
    {
      x: 83,
      y: 3.76351508114206,
      originXData: '2022-05-30',
      type: 'Number of Private Messages per User'
    },
    {
      x: 84,
      y: 1.22202135537901,
      originXData: '2022-05-31',
      type: 'Number of Private Messages per User'
    },
    {
      x: 85,
      y: 1.7803529363753632,
      originXData: '2022-06-01',
      type: 'Number of Private Messages per User'
    },
    {
      x: 86,
      y: 1.267728131617331,
      originXData: '2022-06-02',
      type: 'Number of Private Messages per User'
    },
    {
      x: 87,
      y: 3.227340286052029,
      originXData: '2022-06-03',
      type: 'Number of Private Messages per User'
    },
    {
      x: 88,
      y: 0.661668615725415,
      originXData: '2022-06-04',
      type: 'Number of Private Messages per User'
    },
    {
      x: 89,
      y: 3.246025623322408,
      originXData: '2022-06-05',
      type: 'Number of Private Messages per User'
    },
    {
      x: 90,
      y: 1.3335764819663671,
      originXData: '2022-06-06',
      type: 'Number of Private Messages per User'
    },
    {
      x: 91,
      y: 1.741430660250139,
      originXData: '2022-06-07',
      type: 'Number of Private Messages per User'
    },
    {
      x: 92,
      y: 4.351094223144934,
      originXData: '2022-06-08',
      type: 'Number of Private Messages per User'
    },
    {
      x: 93,
      y: 0.085629074470341,
      originXData: '2022-06-09',
      type: 'Number of Private Messages per User'
    },
    {
      x: 94,
      y: 0.5925681882904861,
      originXData: '2022-06-10',
      type: 'Number of Private Messages per User'
    },
    {
      x: 95,
      y: 1.013151233597585,
      originXData: '2022-06-11',
      type: 'Number of Private Messages per User'
    },
    {
      x: 96,
      y: 0.999128791000602,
      originXData: '2022-06-12',
      type: 'Number of Private Messages per User'
    },
    {
      x: 97,
      y: 1.556248326348268,
      originXData: '2022-06-13',
      type: 'Number of Private Messages per User'
    },
    {
      x: 98,
      y: 2.037101388253879,
      originXData: '2022-06-14',
      type: 'Number of Private Messages per User'
    },
    {
      x: 99,
      y: 2.42241572339565,
      originXData: '2022-06-15',
      type: 'Number of Private Messages per User'
    },
    {
      x: 100,
      y: 5.5253640045926335,
      originXData: '2022-06-16',
      type: 'Number of Private Messages per User'
    },
    {
      x: 101,
      y: 0.9908309309721931,
      originXData: '2022-06-17',
      type: 'Number of Private Messages per User'
    },
    {
      x: 102,
      y: 0.8486918887953661,
      originXData: '2022-06-18',
      type: 'Number of Private Messages per User'
    },
    {
      x: 103,
      y: 4.233329079605447,
      originXData: '2022-06-19',
      type: 'Number of Private Messages per User'
    },
    {
      x: 104,
      y: 2.239616259510069,
      originXData: '2022-06-20',
      type: 'Number of Private Messages per User'
    },
    {
      x: 105,
      y: 0.10908279405984601,
      originXData: '2022-06-21',
      type: 'Number of Private Messages per User'
    },
    {
      x: 106,
      y: 23.51884099646193,
      originXData: '2022-06-22',
      type: 'Number of Private Messages per User'
    },
    {
      x: 107,
      y: 0.41568301223291604,
      originXData: '2022-06-23',
      type: 'Number of Private Messages per User'
    },
    {
      x: 108,
      y: 1.840590020030168,
      originXData: '2022-06-24',
      type: 'Number of Private Messages per User'
    },
    {
      x: 109,
      y: 0.5532414004550751,
      originXData: '2022-06-25',
      type: 'Number of Private Messages per User'
    },
    {
      x: 110,
      y: 2.715172232506665,
      originXData: '2022-06-26',
      type: 'Number of Private Messages per User'
    },
    {
      x: 111,
      y: 2.679757899115613,
      originXData: '2022-06-27',
      type: 'Number of Private Messages per User'
    },
    {
      x: 112,
      y: 1.105137522496868,
      originXData: '2022-06-28',
      type: 'Number of Private Messages per User'
    },
    {
      x: 113,
      y: 1.347929408272255,
      originXData: '2022-06-29',
      type: 'Number of Private Messages per User'
    },
    {
      x: 114,
      y: 0.5491110504617991,
      originXData: '2022-06-30',
      type: 'Number of Private Messages per User'
    },
    {
      x: 115,
      y: 0.885618995495125,
      originXData: '2022-07-01',
      type: 'Number of Private Messages per User'
    },
    {
      x: 116,
      y: 1.040394051716164,
      originXData: '2022-07-02',
      type: 'Number of Private Messages per User'
    },
    {
      x: 117,
      y: 0.387838034146796,
      originXData: '2022-07-03',
      type: 'Number of Private Messages per User'
    },
    {
      x: 118,
      y: 0.33504623462675404,
      originXData: '2022-07-04',
      type: 'Number of Private Messages per User'
    },
    {
      x: 119,
      y: 3.278091213717644,
      originXData: '2022-07-05',
      type: 'Number of Private Messages per User'
    },
    {
      x: 120,
      y: 5.134166854414464,
      originXData: '2022-07-06',
      type: 'Number of Private Messages per User'
    },
    {
      x: 121,
      y: 0.15787863433545202,
      originXData: '2022-07-07',
      type: 'Number of Private Messages per User'
    },
    {
      x: 122,
      y: 3.695856221993309,
      originXData: '2022-07-08',
      type: 'Number of Private Messages per User'
    },
    {
      x: 123,
      y: 0.9204718402028381,
      originXData: '2022-07-09',
      type: 'Number of Private Messages per User'
    },
    {
      x: 124,
      y: 12.292686689327372,
      originXData: '2022-07-10',
      type: 'Number of Private Messages per User'
    },
    {
      x: 125,
      y: 0.22569823789057203,
      originXData: '2022-07-11',
      type: 'Number of Private Messages per User'
    },
    {
      x: 126,
      y: 0.057003071478754004,
      originXData: '2022-07-12',
      type: 'Number of Private Messages per User'
    },
    {
      x: 127,
      y: 1.886305858547745,
      originXData: '2022-07-13',
      type: 'Number of Private Messages per User'
    },
    {
      x: 128,
      y: 38.67416013838181,
      originXData: '2022-07-14',
      type: 'Number of Private Messages per User'
    },
    {
      x: 129,
      y: 0.34417591219448,
      originXData: '2022-07-15',
      type: 'Number of Private Messages per User'
    },
    {
      x: 130,
      y: 0.153576028704162,
      originXData: '2022-07-16',
      type: 'Number of Private Messages per User'
    },
    {
      x: 131,
      y: 1.283391109459497,
      originXData: '2022-07-17',
      type: 'Number of Private Messages per User'
    },
    {
      x: 132,
      y: 0.084950117524903,
      originXData: '2022-07-18',
      type: 'Number of Private Messages per User'
    },
    {
      x: 133,
      y: 0.865719136965563,
      originXData: '2022-07-19',
      type: 'Number of Private Messages per User'
    },
    {
      x: 134,
      y: 1.104677623595627,
      originXData: '2022-07-20',
      type: 'Number of Private Messages per User'
    },
    {
      x: 135,
      y: 0.41221237294221,
      originXData: '2022-07-21',
      type: 'Number of Private Messages per User'
    },
    {
      x: 136,
      y: 12.159275730149757,
      originXData: '2022-07-22',
      type: 'Number of Private Messages per User'
    },
    {
      x: 137,
      y: 0.9694788164354201,
      originXData: '2022-07-23',
      type: 'Number of Private Messages per User'
    },
    {
      x: 138,
      y: 1.062993342271482,
      originXData: '2022-07-24',
      type: 'Number of Private Messages per User'
    },
    {
      x: 139,
      y: 0.591416124923933,
      originXData: '2022-07-25',
      type: 'Number of Private Messages per User'
    },
    {
      x: 140,
      y: 2.192979954983851,
      originXData: '2022-07-26',
      type: 'Number of Private Messages per User'
    },
    {
      x: 141,
      y: 1.63427958962943,
      originXData: '2022-07-27',
      type: 'Number of Private Messages per User'
    },
    {
      x: 142,
      y: 1.311736714260567,
      originXData: '2022-07-28',
      type: 'Number of Private Messages per User'
    },
    {
      x: 143,
      y: 2.995565219170837,
      originXData: '2022-07-29',
      type: 'Number of Private Messages per User'
    },
    {
      x: 144,
      y: 0.324341917122049,
      originXData: '2022-07-30',
      type: 'Number of Private Messages per User'
    },
    {
      x: 145,
      y: 0.5534444716525361,
      originXData: '2022-07-31',
      type: 'Number of Private Messages per User'
    },
    {
      x: 146,
      y: 0.529330910775445,
      originXData: '2022-08-01',
      type: 'Number of Private Messages per User'
    },
    {
      x: 147,
      y: 3.856552869039815,
      originXData: '2022-08-02',
      type: 'Number of Private Messages per User'
    },
    {
      x: 148,
      y: 1.234951845374218,
      originXData: '2022-08-03',
      type: 'Number of Private Messages per User'
    },
    {
      x: 149,
      y: 0.16192153323070702,
      originXData: '2022-08-04',
      type: 'Number of Private Messages per User'
    },
    {
      x: 150,
      y: 2.173110201699371,
      originXData: '2022-08-05',
      type: 'Number of Private Messages per User'
    },
    {
      x: 151,
      y: 11.135752238663327,
      originXData: '2022-08-06',
      type: 'Number of Private Messages per User'
    },
    {
      x: 152,
      y: 0.958792084262276,
      originXData: '2022-08-07',
      type: 'Number of Private Messages per User'
    },
    {
      x: 153,
      y: 2.039075329513739,
      originXData: '2022-08-08',
      type: 'Number of Private Messages per User'
    },
    {
      x: 154,
      y: 2.121594836643942,
      originXData: '2022-08-09',
      type: 'Number of Private Messages per User'
    },
    {
      x: 155,
      y: 3.282862603860423,
      originXData: '2022-08-10',
      type: 'Number of Private Messages per User'
    },
    {
      x: 156,
      y: 0.139231895746797,
      originXData: '2022-08-11',
      type: 'Number of Private Messages per User'
    },
    {
      x: 157,
      y: 0.24122279792940302,
      originXData: '2022-08-12',
      type: 'Number of Private Messages per User'
    },
    {
      x: 158,
      y: 0.7506624109540441,
      originXData: '2022-08-13',
      type: 'Number of Private Messages per User'
    },
    {
      x: 159,
      y: 2.4024472876658223,
      originXData: '2022-08-14',
      type: 'Number of Private Messages per User'
    },
    {
      x: 160,
      y: 2.3650336028113492,
      originXData: '2022-08-15',
      type: 'Number of Private Messages per User'
    },
    {
      x: 161,
      y: 1.423465983705226,
      originXData: '2022-08-16',
      type: 'Number of Private Messages per User'
    },
    {
      x: 162,
      y: 0.8585472144660361,
      originXData: '2022-08-17',
      type: 'Number of Private Messages per User'
    },
    {
      x: 163,
      y: 1.189643421133775,
      originXData: '2022-08-18',
      type: 'Number of Private Messages per User'
    },
    {
      x: 164,
      y: 0.9837464357223601,
      originXData: '2022-08-19',
      type: 'Number of Private Messages per User'
    },
    {
      x: 165,
      y: 0.059870034265504,
      originXData: '2022-08-20',
      type: 'Number of Private Messages per User'
    },
    {
      x: 166,
      y: 12.55656527594101,
      originXData: '2022-08-21',
      type: 'Number of Private Messages per User'
    },
    {
      x: 167,
      y: 1.195140815195466,
      originXData: '2022-08-22',
      type: 'Number of Private Messages per User'
    },
    {
      x: 168,
      y: 2.5846045653914143,
      originXData: '2022-08-23',
      type: 'Number of Private Messages per User'
    },
    {
      x: 169,
      y: 6.813674272547164,
      originXData: '2022-08-24',
      type: 'Number of Private Messages per User'
    },
    {
      x: 170,
      y: 22.12581500864155,
      originXData: '2022-08-25',
      type: 'Number of Private Messages per User'
    },
    {
      x: 171,
      y: 0.29065103217099203,
      originXData: '2022-08-26',
      type: 'Number of Private Messages per User'
    },
    {
      x: 172,
      y: 2.068004826572326,
      originXData: '2022-08-27',
      type: 'Number of Private Messages per User'
    },
    {
      x: 173,
      y: 1.3431857507096732,
      originXData: '2022-08-28',
      type: 'Number of Private Messages per User'
    },
    {
      x: 174,
      y: 1.07779591413233,
      originXData: '2022-08-29',
      type: 'Number of Private Messages per User'
    },
    {
      x: 175,
      y: 0.13247782324235202,
      originXData: '2022-08-30',
      type: 'Number of Private Messages per User'
    },
    {
      x: 176,
      y: 0.28572976740870504,
      originXData: '2022-08-31',
      type: 'Number of Private Messages per User'
    },
    {
      x: 177,
      y: 2.229208371156883,
      originXData: '2022-09-01',
      type: 'Number of Private Messages per User'
    },
    {
      x: 178,
      y: 0.0022491420541680004,
      originXData: '2022-09-02',
      type: 'Number of Private Messages per User'
    },
    {
      x: 179,
      y: 1.8648831840830011,
      originXData: '2022-09-03',
      type: 'Number of Private Messages per User'
    }
  ]
};
spec.series.forEach(s => {
  s.data.values = dataJson[s.data.id];
});

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关文档

- [滚动条 Demo](https://www.visactor.io/vchart/demo/scrollbar/basic-scrollbar-bar-chart)
- [滚动条教程](https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Scrollbar)
- [相关 api](https://www.visactor.io/vchart/option/commonChart#scrollbar)
- [github](https://github.com/VisActor/VChart)
