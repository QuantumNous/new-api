**Chart Types**  
VChart supports various different chart types, allowing users to visualize abstract data through simple configuration, including combination chart, line chart, area chart, bar/column chart, pie/doughnut chart, scatter plot, heat map, histogram, box plot, waterfall chart, progress bar, funnel chart, time series chart, interval column chart, interval area chart, word cloud, dashboard, treemap, Sankey diagram, rose chart, radar chart, map, Circle Packing, sunburst diagram, etc. For a complete description of chart types and how to use them, please refer to [VChart Options](../../../option).

![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/39b8dd02abe79e47954774000.png)

To set the default chart type, use:

```
{
    type: 'line' ,
    data: []
}
```

You can also combine multiple chart series flexibly and freely by using combination charts:

```
{
    type: 'common',
    series: [{
        type: 'line',
        data: []
    }, {
        type: 'bar',
        data: []
    }]
}
```

For more information about how to declare combination charts, please refer to [VChart commonChart Options](../../../option/commonChart).

For instructions on how to use each chart type, please refer to the documentation on the left side of the menu bar.
