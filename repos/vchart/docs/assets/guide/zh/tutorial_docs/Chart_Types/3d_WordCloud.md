3D 词云图

3D 词云的配置大部分继承了普通词云的配置，区别在于 type 需要配置成 wordcloud3d，然后 ChartSpace 实例化时添加 option3d 配置

## 图表构成

词云由文字图元、提示信息及其他组件构成。

![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/dfd203ff5e337abea49411b07.png)

文字图元为词云的基本要素，相关的绘制配置必不可少:

- `wordCloudChart.type`: 图表类型，3d 词云的类型为`'wordCloud3d'`
- `wordCloudChart.data`: 图表绘制的数据源
- `wordCloudChart.nameField`: 文本字段，映射文字图元的文本
- `wordCloudChart.valueField`: 数值字段，映射文字图元的大小

提示信息等作为辅助图表展示的组件，属于可选配置，自带默认效果和功能:

- `wordCloudChart.tooltip`: 提示信息，默认交互时显示，详细配置见[VChart 提示信息组件配置](../../option/wordCloudChart#tooltip)
- 更多组件配置见[VChart wordCloudChart 配置](../../option/wordCloudChart)
  作为 3d 图表，3d 散点图需要开启 3d 视图，需要在 vchart 的初始化参数中配置 3d 视角:

- `options3d.enable`: 启用 3d 视角

代码演示

```javascript livedemo
/**
 * 自2.0.0版本后，3d图表从vchart-extension中引入
 *
 * import { registerWordCloud3dChart } from '@visactor/vchart-extension';
 *
 * registerWordCloud3dChart();
 */

/** --Remove the following code when using in business-- */
if (VChartExtension.registerWordCloud3dChart) {
  VChartExtension.registerWordCloud3dChart();
}
/** --Remove the above code when using in business-- */

const spec = {
  type: 'wordCloud3d',
  maskShape: `https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/log.jpeg`,
  nameField: 'challenge_name',
  valueField: 'sum_count',
  seriesField: 'challenge_name',
  data: [
    {
      name: 'data',
      values: [
        {
          challenge_name: '刘浩存',
          sum_count: 957
        },
        {
          challenge_name: '刘昊然',
          sum_count: 942
        },
        {
          challenge_name: '喜欢',
          sum_count: 842
        },
        {
          challenge_name: '真的',
          sum_count: 828
        },
        {
          challenge_name: '四海',
          sum_count: 665
        },
        {
          challenge_name: '好看',
          sum_count: 627
        },
        {
          challenge_name: '评论',
          sum_count: 574
        },
        {
          challenge_name: '好像',
          sum_count: 564
        },
        {
          challenge_name: '沈腾',
          sum_count: 554
        },
        {
          challenge_name: '不像',
          sum_count: 540
        },
        {
          challenge_name: '多少钱',
          sum_count: 513
        },
        {
          challenge_name: '韩寒',
          sum_count: 513
        },
        {
          challenge_name: '不知道',
          sum_count: 499
        },
        {
          challenge_name: '感觉',
          sum_count: 499
        },
        {
          challenge_name: '尹正',
          sum_count: 495
        },
        {
          challenge_name: '不看',
          sum_count: 487
        },
        {
          challenge_name: '奥特之父',
          sum_count: 484
        },
        {
          challenge_name: '阿姨',
          sum_count: 482
        },
        {
          challenge_name: '支持',
          sum_count: 482
        },
        {
          challenge_name: '父母',
          sum_count: 479
        },
        {
          challenge_name: '一条',
          sum_count: 462
        },
        {
          challenge_name: '女主',
          sum_count: 456
        },
        {
          challenge_name: '确实',
          sum_count: 456
        },
        {
          challenge_name: '票房',
          sum_count: 456
        },
        {
          challenge_name: '无语',
          sum_count: 443
        },
        {
          challenge_name: '干干净净',
          sum_count: 443
        },
        {
          challenge_name: '为啥',
          sum_count: 426
        },
        {
          challenge_name: '爱情',
          sum_count: 425
        },
        {
          challenge_name: '喜剧',
          sum_count: 422
        },
        {
          challenge_name: '春节',
          sum_count: 414
        },
        {
          challenge_name: '剧情',
          sum_count: 414
        },
        {
          challenge_name: '人生',
          sum_count: 409
        },
        {
          challenge_name: '风格',
          sum_count: 408
        },
        {
          challenge_name: '演员',
          sum_count: 403
        },
        {
          challenge_name: '成长',
          sum_count: 403
        },
        {
          challenge_name: '玩意',
          sum_count: 402
        },
        {
          challenge_name: '文学',
          sum_count: 397
        }
      ]
    }
  ],
  word: {
    style: {
      keepDirIn3d: false
    }
  },
  fillingWord: {
    style: {
      keepDirIn3d: false
    }
  },
  depth_3d: 1000
};

const vchart = new VChart(spec, {
  dom: CONTAINER_ID,
  disableDirtyBounds: true,
  options3d: {
    enable: true
  }
});
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

其他配置参考[词云]()
