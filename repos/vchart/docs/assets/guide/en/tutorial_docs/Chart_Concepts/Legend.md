# Legend

Legend is an auxiliary mark in charts, which distinguishes different data groups by color, shape, and size, helping to better convey the meaning of different visual encoding. It is also commonly used for data filtering in charts. In VChart, legends are divided into discrete legends and continuous legends according to the associated data types, and continuous legends are further divided into color legends and size legends. This tutorial mainly explains the related concepts and composition of Legend. For more detailed configuration and examples of Legend, please refer to the [configuration document](../../../option) and [example](../../../example) pages.

## Discrete Legend

Discrete legends are used to represent data categories distinguished by different colors or shapes in a chart.

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/48c337ece11d289fc4644a215.png" alt="Discrete Legend Illustration">
</div>

### Composition

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/a2c7623458257d15626270911.png" alt="Discrete Legend Composition">
</div>

Discrete legends consist of the following parts:

1. Legend title `title`: Represents the name of the legend
2. Legend item `item` represents each data category, each legend item consists of the following components

- shape: The shape of the legend item, usually corresponding to the specific chart type
- label: Legend item text, representing the name of the category
- value: Legend item value, which can display the corresponding value of the category if there are
- background: Legend item background, setting the background color or transparency style of the legend item

3. Paginator: Automatically paginate when there are too many legend items for easy browsing and operation

### Layout

Currently, discrete legends are divided into horizontal and vertical layouts. In different layout methods, the layout and occupancy of the title, legend items, and paginator in the legend are as follows:

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/eb08aeafba39ab34c8a08c615.png" alt="Layout Illustration">
</div>

The current default layout strategy is a flow layout, that is

- Horizontal layout: The legend items in the horizontal layout are arranged from left to right. If a maximum width (`maxWidth`) is set, the following will happen:
  - If `autoPage` is configured (i.e., automatic pagination, default is true), the paginator will automatically appear according to the `maxRow` (the restricted number of rows, default is 2)
  - If `autoPage` is false, automatic line breaks will be performed
- Vertical layout: The legend items in the vertical layout are arranged from top to bottom. If a maximum height (`maxHeight`) is set, the following will happen:
  - If `autoPage` is configured (i.e., automatic pagination, default is true), the paginator will automatically appear according to the `maxCol` (the restricted number of columns, default is 1)
  - If `autoPage` is false, automatic column breaks will be performed

### Interaction

Legends allow interaction, and different styles respond to different interaction states, including:

1. Interaction when the mouse hovers over the legend item
2. Interaction when the mouse clicks the legend

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/48c337ece11d289fc4644a216.png" alt="Legend Interaction State Example">
</div>

At present, the legend item styles available are:

- `'selected'`: Selected state, indicating that the current legend item is selected
- `'unSelected'`: Unselected state, indicating that the current legend item is not selected
- `'selectedHover'`: Selected and hover state, indicating that the mouse is hovering over the selected legend item
- `'unSelectedHover'`: Unselected and hover state, indicating that the mouse is hovering over the selected legend item

Additionally, the paginator also provides its own interaction state style configuration, including:

1. Interaction when the mouse hovers over the button
2. Interaction when the mouse clicks

This can be configured on `pager.handler.state`, see the [pager configuration documentation](../../../option/barChart#legends-discrete.pager) for details.

## Continuous Legend

The continuous legend is divided into color legends and size legends. Color legends are used to represent the continuous changing characteristics of data with the change of color, while size legends are used to represent the continuous changing characteristics of data with the change of size and can also be used for data filtering.

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/0a2e223bdcd7410c08f6a6a13.png" alt="Continuous Legend Schematic">
</div>

### Composition

The continuous legend is divided into color legends and size legends, both of which consist of the following parts:

1. Legend title `title`: Represents the name of the legend
2. Slider rail `rail`: Represents the continuous range of value changes
3. Slider track `track`: Represents the currently selected value range
4. Start and end text `handlerText`: Represents the minimum and maximum values of the continuous range

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/a222eb3ecfe32db85220dda00.png" alt="Continuous Legend Composition Schematic">
</div>

## Customizing Legends

VChart's legend component provides rich configuration options to meet various data visualization needs and also provides related [API interfaces](/vchart/api/API/vchart). When the default legend cannot meet the business requirements, the legend can be customized through the legend configuration options and related api interfaces.

### UI Customization

When the overall legend display style does not meet the requirements, you can use the `visible` property to close the legend display, and then implement custom legend display and interaction through the provided related legend [API](/vchart/api/API/vchart) (`vchart.getLegendSelectedDataByIndex()` to get the legend item data, `vchart.setLegendSelectedDataByIndex()` to set the selected data of the legend item).

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

### Customizing Legend Interaction

By default, discrete legends provide data filtering interaction. If you need to customize the interaction, you can first close the `select` configuration of the `legend`. Then use the `legendItemHover` and `legendItemUnHover` events and state update API to achieve it.

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

### Customizing Legend Item Data

In the discrete legend, when the legend item data does not meet the requirements, you can customize the legend item data through the `data` configuration.

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

For more examples of `legend`, please refer to [Legend](../../../example).
