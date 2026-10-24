---
category: examples
group: chart-3d
title: 3D Shape Word Cloud
keywords: space
order: 23-6
cover: /vchart/preview/wordcloud3d_1.13.3.gif
option: wordCloud3dChart
---

# Shape Word Cloud

The configuration of 3D word clouds mainly inherits the configuration of ordinary word clouds. The difference is that the type needs to be set to wordcloud3d, and then the ChartSpace instance needs to be added with the option3d configuration.

## Key option

- The `depth_3d` attribute is declared as a numeric field, indicating the distance of the word cloud from the screen.
- The `keepDirIn3d` text attribute configuration controls whether the text direction follows the rotation.
- The `options3d` configuration is passed into the ChartSpace constructor, declaring that the ChartSpace needs to support 3D mode.
- The `nameField` attribute is declared as a text field for the words.
- The `valueField` attribute is declared as a field for the text size.
- The `maskShape` attribute is declared as the shape outline, supporting both image URL and shape string formats.

## Demo source

```javascript livedemo
/**
 * Since version 2.0.0, 3D charts are imported from vchart-extension.
 *
 * import { registerWordCloud3dChart } from '@visactor/vchart-extension';
 *
 * registerWordCloud3dChart();
 */

/** --Remove the following code when using in production-- */
if (VChartExtension.registerWordCloud3dChart) {
  VChartExtension.registerWordCloud3dChart();
}
/** --Remove the above code when using in production-- */

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

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorials

[3D Word Cloud](link)
