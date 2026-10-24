# Legend 图例

图例是图表中的辅助标记，通过颜色、形状、大小来区分不同的数据分组，有助于更好地传达不同视觉编码的含义，也常用于图表中数据的筛选。在 VChart 中图例根据关联的数据类型的不同分为离散图例和连续图例，其中连续图例又分为颜色图例和尺寸图例。本教程主要讲解 Legend 的相关概念以及组成，关于 Legend 更加详细的配置及示例，详见[配置项文档](../../../option)及[示例](../../../example)页面。

## 离散图例

离散图例是用于表示图表中由不同颜色或形状区分的数据类别。

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/48c337ece11d289fc4644a215.png" alt="离散图例图示">
</div>

### 组成

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/a2c7623458257d15626270911.png" alt="离散图例组成图示">
</div>

离散图例由以下部分组成：

1.  图例标题 `title`：表示图例的名称
2.  图例项 `item` 表示各个数据类别，其中每个图例项由以下部件组成

- shape：图例项的 shape，通常同具体的图表类型相对应
- label：图例项文本，表示该类别的名称
- value：图例项数值，如果有可以显示该类别对应的数值
- background：图例项背景，设置图例项的背景颜色或透明度等样式

3.  分页器：当图例项过多时会自动分页，方便用户浏览和操作

### 布局

目前离散图例分为水平布局和垂直布局两种布局方式，在不同的布局方式下，图例内部的标题、图例项和分页器的布局占位如下：

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/eb08aeafba39ab34c8a08c615.png" alt="布局图示">
</div>

目前默认布局策略为流式布局，即

- 水平布局：水平布局下的图例项会做从左到右的布局。如果设置了限制宽度（`maxWidth`），超出之后：
  - 如果配置了 `autoPage` （即自动分页，默认为 true） 则会根据配置项 `maxRow` (限制的行数，默认为 2) 自动出现分页器
  - 如果 `autoPage` 为 false，则进行自动换行
- 垂直布局：垂直布局下的图例项会做自上到下的布局。如果设置了限制高度（`maxHeight`），超出之后：
  - 如果配置了 `autoPage` （即自动分页，默认为 true） 则会根据配置项 `maxCol` (限制的列数 ，默认为 1) 自动出现分页器
  - 如果 `autoPage` 为 false，则进行自动换列

### 交互

图例是允许交互的，在不同的交互状态下会有不同的样式响应，包含：

1.  鼠标悬浮到图例项时的交互
2.  鼠标点击图例时的交互

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/48c337ece11d289fc4644a216.png" alt="图例交互状态图例">
</div>

目前提供了图例项在如下交互状态的样式配置：

- `'selected'`：选中态，表示当前图例项被选中
- `'unSelected'`：非选中状态，表示当前图例项未被选中
- `'selectedHover'`：选中并 hover 状态，表示鼠标悬浮在选中的图例项上
- `'unSelectedHover'`：非选中并 hover 状态，表示鼠标悬浮在选中的图例项上

另外分页器也提供了自己的交互状态样式配置，包含：

1.  鼠标 hover 到按钮时的交互
2.  鼠标点击时的交互

可在 `pager.handler.state` 上进行配置，详见[pager 配置项文档](../../../option/barChart#legends-discrete.pager)。

## 连续图例

连续图例分为颜色图例和尺寸图例，其中颜色图例用于表示数据随着颜色的变化而呈现出的连续变化特征，尺寸图例用于表示数据随着尺寸的变化而呈现出的连续变化特征，也可进行数据筛选。

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/0a2e223bdcd7410c08f6a6a13.png" alt="连续图例示意图">
</div>

### 组成

连续图例分为颜色图例和尺寸图例，均由以下部分组成：

1.  图例标题 `title`：表示图例的名称
2.  滑块轨道 `rail`：表示数值变化的连续区间
3.  滑块条 `track`：表示当前选择的数值范围
4.  起始、结束文本 `handlerText`：表示连续区间的最小值和最大值

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/a222eb3ecfe32db85220dda00.png" alt="连续图例组成示意图">
</div>

## 自定义图例

VChart 的图例组件提供了丰富的配置项，可以满足各种数据可视化需求，同时也提供了相关的 [API 接口](/vchart/api/API/vchart)，当默认的图例无法满足业务需求时，可以通过图例配置项以及相关的 api 接口来进行图例的自定义。

### UI 自定义

当图例整体的展示样式不满足需求时，可以通过 `visible` 属性关闭图例的展示，然后通过提供的相关图例的 [API](/vchart/api/API/vchart)（`vchart.getLegendSelectedDataByIndex()` 获取图例项数据，`vchart.setLegendSelectedDataByIndex()` 设置图例项的选中数据）实现自定义图例的展示及交互。

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'line',
      values: [
        { x: 'Round 1', y: 21, c: 'Role A' },
        { x: 'Round 1', y: 38, c: 'Role B' },
        { x: 'Round 2', y: 28, c: 'Role A' },
        { x: 'Round 2', y: 45, c: 'Role B' },
        { x: 'Round 3', y: 22, c: 'Role A' },
        { x: 'Round 3', y: 56, c: 'Role B' },
        { x: 'Round 4', y: 34, c: 'Role A' },
        { x: 'Round 4', y: 48, c: 'Role B' },
        { x: 'Round 5', y: 34, c: 'Role A' },
        { x: 'Round 5', y: 64, c: 'Role B' },
        { x: 'Round 6', y: 44, c: 'Role A' },
        { x: 'Round 6', y: 72, c: 'Role B' },
        { x: 'Round 7', y: 38, c: 'Role A' },
        { x: 'Round 7', y: 65, c: 'Role B' },
        { x: 'Round 8', y: 24, c: 'Role A' },
        { x: 'Round 8', y: 70, c: 'Role B' },
        { x: 'Round 9', y: 28, c: 'Role A' },
        { x: 'Round 9', y: 62, c: 'Role B' }
      ]
    }
  ],
  xField: 'x',
  yField: 'y',
  seriesField: 'c',
  axes: [{ orient: 'left' }, { orient: 'bottom' }],
  legends: {
    visible: false
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

const legendSelected = vchart.getLegendSelectedDataByIndex();
const chartDiv = document.getElementById(CONTAINER_ID);
const checkboxContainer = document.createElement('div');
checkboxContainer.style.textAlign = 'center';
const checkbox = document.createElement('input');
const checkboxLabel = document.createElement('label');

checkbox.setAttribute('type', 'checkbox');
checkbox.setAttribute('id', 'checkbox');
checkbox.style.verticalAlign = 'middle';

checkbox.checked = false;

checkboxLabel.innerText = ' 隐藏绿水灵';
checkboxLabel.style.verticalAlign = 'middle';

checkboxContainer.appendChild(checkbox);
checkboxContainer.appendChild(checkboxLabel);
chartDiv?.prepend(checkboxContainer);

checkbox.addEventListener('change', event => {
  if (event.currentTarget.checked) {
    vchart.setLegendSelectedDataByIndex(
      0,
      legendSelected.filter(val => val !== '绿水灵')
    );
  } else {
    vchart.setLegendSelectedDataByIndex(0, legendSelected);
  }
});
```

### 自定义图例交互

离散图例默认提供了数据筛选的交互。如果需要自定义选中交互，可以先关闭 `legend` 的 `select` 配置。然后通过 `legendItemHover` 和 `legendItemUnHover` 事件以及状态更新 API 来实现。

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'bar',
      values: [
        { year: '2012', type: 'Forest', value: 320 },
        { year: '2012', type: 'Steppe', value: 220 },
        { year: '2012', type: 'Desert', value: 150 },
        { year: '2012', type: 'Wetland', value: 98 },
        { year: '2013', type: 'Forest', value: 332 },
        { year: '2013', type: 'Steppe', value: 182 },
        { year: '2013', type: 'Desert', value: 232 },
        { year: '2013', type: 'Wetland', value: 77 },
        { year: '2014', type: 'Forest', value: 301 },
        { year: '2014', type: 'Steppe', value: 191 },
        { year: '2014', type: 'Desert', value: 201 },
        { year: '2014', type: 'Wetland', value: 101 },
        { year: '2015', type: 'Forest', value: 334 },
        { year: '2015', type: 'Steppe', value: 234 },
        { year: '2015', type: 'Desert', value: 154 },
        { year: '2015', type: 'Wetland', value: 99 },
        { year: '2016', type: 'Forest', value: 390 },
        { year: '2016', type: 'Steppe', value: 290 },
        { year: '2016', type: 'Desert', value: 190 },
        { year: '2016', type: 'Wetland', value: 40 }
      ]
    }
  ],
  xField: ['year', 'type'],
  yField: 'value',
  seriesField: 'type',
  stateDef: {
    legend_hover: {
      filter: datum => {
        return true;
      }
    }
  },
  legends: [
    {
      orient: 'top',
      position: 'middle',
      padding: {
        bottom: 12
      },
      select: false, // 关闭图例默认选中交互
      data: items => {
        return items.map(item => {
          item.shape.outerBorder = {
            stroke: item.shape.fill,
            distance: 2,
            lineWidth: 1
          };

          return item;
        });
      },
      item: {
        shape: {
          space: 8
        },
        background: {
          visible: false
        }
      }
    }
  ],
  crosshair: {
    xField: {
      visible: true,
      label: {
        visible: false
      }
    },
    yField: {
      visible: false
    }
  },
  bar: {
    state: {
      legend_hover_reverse: {
        fill: '#ccc'
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });

vchart.on('legendItemHover', e => {
  const hoveredName = e?.value?.data?.label;
  if (hoveredName) {
    vchart.updateState({
      legend_hover_reverse: {
        filter: d => d.type !== hoveredName
      }
    });
  }
});
vchart.on('legendItemUnHover', e => {
  vchart.updateState({
    legend_hover_reverse: {
      filter: d => false
    }
  });
});

vchart.renderSync();
```

### 自定义图例项数据

在离散图例中，当图例项的数据不符合要求时，可以通过 `data` 配置来自定义图例项的数据。

```javascript livedemo
const data = [
  { value: 10, category: 'One' },
  { value: 9, category: 'Two' },
  { value: 6, category: 'Three' },
  { value: 5, category: 'Four' },
  { value: 4, category: 'Five' },
  { value: 3, category: 'Six' },
  { value: 1, category: 'Seven' }
];
let totalValue = 0;
data.forEach(obj => (totalValue += obj.value));
const map = {};
data.forEach(obj => {
  map[obj.category] = `${((obj.value / totalValue) * 100).toFixed(2)}%`;
});

const spec = {
  type: 'pie',
  data: [
    {
      id: 'pie',
      values: data
    }
  ],
  categoryField: 'category',
  valueField: 'value',
  legends: {
    visible: true,
    orient: 'right',
    data: items => {
      return items.map(item => {
        item.value = map[item.label];
        return item;
      });
    },
    item: {
      width: '15%',
      value: {
        alignRight: true,
        style: {
          fill: '#333',
          fillOpacity: 0.8,
          fontSize: 10
        },
        state: {
          unselected: {
            fill: '#d8d8d8'
          }
        }
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });

vchart.on('legendItemHover', e => {
  const hoveredName = e?.value?.data?.label;
  if (hoveredName) {
    vchart.updateState({
      legend_hover_reverse: {
        filter: d => d.type !== hoveredName
      }
    });
  }
});
vchart.on('legendItemUnHover', e => {
  vchart.updateState({
    legend_hover_reverse: {
      filter: d => false
    }
  });
});

vchart.renderSync();
```

更多 `legend` 的示例请参考 [图例](../../../example)。
