**图表类型**  
VChart 支持多种不同的图表类型，使用户通过简单的配置即可对抽象数据进行可视化，包括组合图、折线图、面积图、柱状图/条形图、饼/环图、散点图、色块图、直方图、箱形图、瀑布图、进度条、漏斗图、时序图、区间柱图、区间面积图、词云、仪表盘、矩形树图、桑基图、玫瑰图、雷达图、地图、Circle Packing、旭日图等。有关图表类型和使用方式的完整描述，请参阅[VChart 配置项](../../../option)。

![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/39b8dd02abe79e47954774000.png)

要设置默认图表类型，请使用：

```
{
    type: 'line' ,
    data: []
}
```

也可以通过组合图将多个图表系列灵活自由地组合在一起：

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

有关如何声明组合图的更多信息，请参阅[VChart commonChart 配置项](../../../option/commonChart)。

有关每种图表类型的使用教程，请参阅菜单栏左侧的文档。
