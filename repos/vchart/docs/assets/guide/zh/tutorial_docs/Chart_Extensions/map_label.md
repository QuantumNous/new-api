# 散点地图标签组件

散点地图标签组件是一种非常规的地图标签布局方式，标签是 [MarkPoint 组件](/vchart/guide/tutorial_docs/Chart_Concepts/marker) 的形式，尽可能围绕在地图周边布局。目前只推荐在中国地图中使用。

![img](/vchart/guide/extension/map-label.png)

## 如何使用该组件

散点地图是 VChart 默认支持的，可以通过组合图（Common Chart）实现。

```js
const spec = {
    type: 'common',
    padding: 50,
    region: [
      {
        roam: true,
        coordinate: 'geo',
        longitudeField: 'lon',
        latitudeField: 'lat'
      }
    ],
    series: [
      {
        type: 'map',
        map: 'china',
        nameField: 'name',
        valueField: 'value',
        seriesField: 'name',
      },
      {
        regionIndex: 0,
        id: 'scatter',
        type: 'scatter',
        data: {
          values: [
           ...
          ]
        },
        xField: 'name',
        yField: 'value',
      }
    ]
  };
```

散点地图标签组件需要在图表上注册，注册和使用方式如下：

```js
import VChart from '@visactor/vchart';
import { registerMapLabel } from '@visactor/vchart-extension';

const spec = {
  //  your spec
  type: 'common',
  ...,
  mapLabel: {
    visible: true,
    position: 'outer',
    seriesId: 'scatter',
    nameField: 'name',
    valueField: 'value',
    space: 6,
    nameLabel: {},
    valueLabel: {},
    leader: {},
    background: {}
  }
};
registerMapLabel();

const vchart = new VChart(spec, { dom: 'chart' });
vchart.renderSync();
```

如果是通过 cdn 引入的方式，注册方式如下：

```html
<script src="https://cdn.jsdelivr.net/npm/@visactor/vchart/build/index.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@visactor/vchart-extension/build/index.min.js"></script>
<script>
  const spec = {
    //  your spec
  };
  VChartExtension.registerMapLabel();

  const vchart = new VChart.defatult(spec, { dom: 'chart' });
  vchart.renderSync();
</script>
```

## 相关配置项

```ts
export interface IMapLabelSpec extends IMapLabelStyleSpec {
  /** 关联的系列 id */
  seriesId: StringOrNumber;
  /** 名称文本的数据字段 */
  nameField?: string;
  /** 数值文本的数据字段 */
  valueField?: string;
  /**
   * 交互触发类型
   * @default 'none'
   */
  trigger?: 'hover' | 'click' | 'none';
}

export interface IMapLabelStyleSpec {
  /**
   * 是否显示
   * @default false
   */
  visible?: boolean;
  /**
   * 标签非 outer 位置下与标记点的间距
   * @default 12
   */
  offset?: number;
  /**
   * icon 和 label之间的距离
   * @default 10
   */
  space?: number;
  /**
   * 标签位置。支持 'left' | 'top' | 'right' | 'bottom' | 'outer'
   * @default 'top'
   */
  position?: LabelPosition;
  /** 名称文本样式设置 */
  nameLabel?: {
    visible?: boolean;
    style?: ITextMarkSpec;
  };
  /** 数值文本样式设置 */
  valueLabel?: {
    visible?: boolean;
    style?: ITextMarkSpec;
  };
  /** 图标样式设置 */
  icon?: {
    visible?: boolean;
    style?: ISymbolMarkSpec;
  };
  /** 背景样式设置 */
  background?: {
    /** @default true */
    visible?: boolean;
    /** 背景框边距 */
    padding?: IPadding;
    style?: IRectMarkSpec;
  };
  /** 引导线样式设置 */
  leader?: {
    visible?: boolean;
    style?: IPathMarkSpec;
  };
}
```

## 示例

```javascript livedemo
const spec = {
  type: 'common',
  padding: 50,
  region: [
    {
      roam: true,
      coordinate: 'geo',
      longitudeField: 'lon',
      latitudeField: 'lat'
    }
  ],
  mapLabel: {
    visible: true,
    position: 'outer',
    seriesId: 'scatter',
    nameField: 'name',
    valueField: 'value',
    space: 6,
    icon: {
      visible: true,
      style: {
        size: 20,
        dx: -8,
        dy: -10,
        fill: 'red',
        symbolType: `<svg t="1735530419948" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="18309" width="200" height="200"><path d="M512 14.04046698C285.51594444 14.04046698 101.91573591 198.69592179 101.91573591 426.58535144c0 113.88587391 45.92898631 216.99267454 120.09577941 291.68660449L512 1009.95953302l289.98751211-291.68757709a412.48652979 412.48652979 0 0 0 120.09675198-291.68660449C922.08426409 198.69592179 738.48308299 14.04046698 512 14.04046698z m0 595.7939926a182.78032593 182.78032593 0 0 1-182.31251628-183.36678999A182.72197129 182.72197129 0 0 1 512 243.21856145a182.78032593 182.78032593 0 0 1 182.31154372 183.36678999A182.72197129 182.72197129 0 0 1 512 609.89281421z" fill="#F96C65" p-id="18310"></path></svg>`
      }
    },
    nameLabel: {
      style: { fill: '#1677ff' }
    },
    valueLabel: {
      style: { fill: '#1677ff' }
    },
    leader: {
      visible: true,
      style: { stroke: '#1677ff' }
    },
    background: {
      style: {
        fill: '#e6f4ff',
        stroke: '#1677ff'
      }
    }
  },
  series: [
    {
      type: 'map',
      map: 'china',
      nameField: 'name',
      valueField: 'value',
      seriesField: 'name',
      nameMap: {
        广东省: '广东',
        江苏省: '江苏',
        山东省: '山东',
        河南省: '河南',
        河北省: '河北',
        浙江省: '浙江',
        四川省: '四川',
        安徽省: '安徽',
        辽宁省: '辽宁',
        陕西省: '陕西',
        山西省: '山西',
        湖北省: '湖北',
        北京市: '北京',
        湖南省: '湖南',
        黑龙江省: '黑龙江',
        福建省: '福建',
        内蒙古自治区: '内蒙古',
        云南省: '云南',
        江西省: '江西',
        重庆市: '重庆',
        上海市: '上海',
        贵州省: '贵州',
        吉林省: '吉林',
        天津市: '天津',
        广西壮族自治区: '广西',
        甘肃省: '甘肃',
        新疆维吾尔自治区: '新疆',
        宁夏回族自治区: '宁夏',
        海南省: '海南',
        青海省: '青海',
        西藏自治区: '西藏',
        香港特别行政区: '中国香港',
        台湾省: '中国台湾',
        澳门特别行政区: '澳门'
      },
      area: {
        style: {
          fill: '#E9F2FF',
          stroke: 'grey',
          lineWidth: 1
        }
      }
    },
    {
      regionIndex: 0,
      id: 'scatter',
      type: 'scatter',
      data: {
        values: [
          {
            name: '乌鲁木齐',
            value: '2197',
            lat: '43.50',
            lon: '87.37'
          },
          {
            name: '济南',
            value: '2197',
            lat: '36.606472',
            lon: '117.164382'
          },
          {
            name: '江苏',
            value: '21197',
            lat: '32.983908',
            lon: '119.486395'
          },
          {
            name: '成都',
            value: '21197',
            lat: '30.659462',
            lon: '104.065735'
          }
        ]
      },
      xField: 'name',
      yField: 'value',
      point: {
        style: {
          fill: '#1677ff',
          outerBorder: {
            distance: 2,
            lineWidth: 3,
            strokeOpacity: 0.2
          },
          fillOpacity: 1,
          size: 10
        }
      }
    }
  ]
};

const mapURL = 'https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json';
const res = await fetch(mapURL);
const geojson = await res.json();
VChart.registerMap('china', geojson, {
  rewind: true
});

VChartExtension.registerMapLabel();
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```
