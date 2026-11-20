---
title: 79.如何调整线图中线的层级</br>
---
## 问题标题

VChart如何调整线图中线的层级？</br>


## 问题描述

如下图的线图中，怎么使蓝色的线置于顶层呢？</br>


<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/LF0lb94KLolZl5xYkK3c0kmQnwb.gif' alt='' width='1490' height='1030'>

## 解决方案

线图展示的时候，是根据数据中的分组字段进行分组，分组字段的值出现的最后面的那一分组的层级会比最先出现的分组对应的线层级更高；表现就是上图中的，图例项中最后的一项对应的线，它的层级是最高的；所以想要调整线的层级，有两种方案：</br>
*  根据分组字段，对数据进行排序</br>
*  调整线的`zIndex`视觉通道映射</br>
```
line: {
    style: {
      lineWidth: 2,
      zIndex: (datum) => {
        switch(datum.type) {
          case 'Product A':
            return 3;
          case 'Product B':
            return 2;
          case 'Produce C':
            return 1;
        }
      }
    }
  },</br>
```


## 代码示例 

```
const spec = {
  type: 'line',
  data: {
    values: [
      { date: '2023-01-01', type: 'Product A', value: 99.9 },
      { date: '2023-01-01', type: 'Product B', value: 96.6 },
      { date: '2023-01-01', type: 'Product C', value: 96.2 },
      { date: '2023-01-02', type: 'Product A', value: 96.7 },
      { date: '2023-01-02', type: 'Product B', value: 91.1 },
      { date: '2023-01-02', type: 'Product C', value: 93.4 },
      { date: '2023-01-03', type: 'Product A', value: 100.2 },
      { date: '2023-01-03', type: 'Product B', value: 99.4 },
      { date: '2023-01-03', type: 'Product C', value: 91.7 },
      { date: '2023-01-04', type: 'Product A', value: 104.7 },
      { date: '2023-01-04', type: 'Product B', value: 108.1 },
      { date: '2023-01-04', type: 'Product C', value: 93.1 },
      { date: '2023-01-05', type: 'Product A', value: 95.6 },
      { date: '2023-01-05', type: 'Product B', value: 96 },
      { date: '2023-01-05', type: 'Product C', value: 92.3 },
      { date: '2023-01-06', type: 'Product A', value: 95.6 },
      { date: '2023-01-06', type: 'Product B', value: 89.1 },
      { date: '2023-01-06', type: 'Product C', value: 92.5 },
      { date: '2023-01-07', type: 'Product A', value: 95.3 },
      { date: '2023-01-07', type: 'Product B', value: 89.2 },
      { date: '2023-01-07', type: 'Product C', value: 95.7 },
      { date: '2023-01-08', type: 'Product A', value: 96.1 },
      { date: '2023-01-08', type: 'Product B', value: 97.6 },
      { date: '2023-01-08', type: 'Product C', value: 99.9 },
      { date: '2023-01-09', type: 'Product A', value: 96.1 },
      { date: '2023-01-09', type: 'Product B', value: 100.6 },
      { date: '2023-01-09', type: 'Product C', value: 103.8 },
      { date: '2023-01-10', type: 'Product A', value: 101.6 },
      { date: '2023-01-10', type: 'Product B', value: 108.3 },
      { date: '2023-01-10', type: 'Product C', value: 108.9 }
    ]
  },
  xField: 'date',
  yField: 'value',
  seriesField: 'type',
  point: {
    visible: false
  },
  line: {
    style: {
      lineWidth: 2,
      zIndex: (datum) => {
        switch(datum.type) {
          case 'Product A':
            return 3;
          case 'Product B':
            return 2;
          case 'Produce C':
            return 1;
        }
      }
    }
  },
  legends: { visible: true }
};</br>
```
## 结果展示

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/OEEbbyZ1UoUFtnxyEwTcbh6JnVe.gif' alt='' width='1508' height='1054'>

## 相关文档

*  [github](https%3A%2F%2Fgithub.com%2FVisActor%2FVChart)</br>
*  [style.zIndex配置文档](https%3A%2F%2Fvisactor.com%2Fvchart%2Foption%2FlineChart%23line.style.zIndex)</br>