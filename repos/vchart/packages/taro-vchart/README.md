# @visactor/taro-vchart

VChart 基于 [Taro](https://docs.taro.zone/docs/) 封装的图表组件。

## 环境要求

**Taro 版本: >= 3.3.17**

> taro 因为小版本有一些不兼容的 break change，所以尽量使用 3.3 版本

## 支持环境

目前组件支持的环境有：**微信小程序**('weapp')，**字节小程序**('tt')，**飞书小程序**('lark')，**浏览器**('web')，**h5 移动端**('h5')。

以上环境通过 `type` 属性进行声明，`type` 属性值及对应环境如下：

- `weapp` 微信小程序。
- `tt` 字节小程序。
- `lark` 飞书小程序。
- `h5` h5 移动端环境。
- `web` 浏览器环境。

### 跨端支持

用户如果需要跨多端支持, 需要根据 `Taro.getEnv()` 动态传入 `type` 属性.

```tsx
<VChart
  type={Taro.getEnv()}
  canvasId="chartId"
  spec={spec}
  style={{ height: '100%', width: '100%' }}
  onChartInit={chart => {}}
  onChartReady={chart => {}}
  onChartUpdate={chart => {}}
/>
```

### 版本要求

1. **字节小程序端**

需要确保 **Taro 版本 >= 3.3.17** (taro 因为小版本有一些不兼容的 break change，所以尽量使用 3.3 版本)

2. **飞书小程序端**

需要确保 **Taro 版本 >= 3.2.0**, **飞书版本 >= 3.45.0** (taro 因为小版本有一些不兼容的 break change，所以尽量使用 3.3 版本)

## 安装

```bash
# npm
$ npm install @visactor/taro-vchart

# yarn
$ yarn add @visactor/taro-vchart
```

## API

图表组件使用示例如下：

```tsx
import VChart from '@visactor/taro-vchart';

<VChart
  type="tt"
  spec={spec}
  canvasId="pie"
  style={{ height: '35vh', width: '100%' }}
  onChartInit={chart => {
    console.log('onChartInit');
  }}
  onChartReady={chart => {
    console.log('onChartReady');
  }}
  onChartUpdate={chart => {
    console.log('onChartUpdate');
  }}
/>;
```

| API           | 类型     | 说明                                                                                                                                                                    |
| ------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| type          | String   | 配置的环境，目前组件支持的环境有：**字节小程序**('tt')，**飞书小程序**('lark')，**浏览器**('web')，**h5 移动端**('h5')，如果没有声明，则会通过 `Taro.getEnv()` 自动获取 |
| canvasId      | String   | 图表 id, 必确唯一                                                                                                                                                       |
| spec          | Object   | 图表配置项, 请参考[VChart 配置项](https://www.visactor.io/vchart/option/)                                                                                               |
| style         | Object   | 图表容器样式                                                                                                                                                            |
| events        | Object[] | 事件绑定配置，具体配置为定义[如下](#事件配置)                                                                                                                           |
| options       | Object   | 初始化 VChart 实例传入的额外配置项，同 [VChart 实例化配置项](https://www.visactor.io/vchart/api/API/vchart#options)                                                     |
| onChartInit   | Function | 图表初始化完后触发的回调                                                                                                                                                |
| onChartReady  | Function | 图表渲染完毕后触发的回调                                                                                                                                                |
| onChartUpdate | Function | 图表更新完毕后触发的回调                                                                                                                                                |

### 事件配置

```ts
interface IEvent {
  /**
   * 事件的名称
   */
  type: EventType;
  /**
   * 事件 API 中的事件筛选配置
   */
  query?: EventQuery;
  /**
   * 事件监听函数
   */
  handler: EventCallback<EventParams>;
}
```

- `type` 代表事件名称，支持的值详见：[事件分类](https://www.visactor.io/vchart/api/API/event#%E4%BA%8B%E4%BB%B6%E5%88%86%E7%B1%BB)
- `query` 事件 API 中的事件筛选配置，使用详见：[事件过滤](https://www.visactor.io/vchart/api/API/event#%E4%BA%8B%E4%BB%B6%E8%BF%87%E6%BB%A4)
- `handler` 即事件监听函数，函数的参数类型详见：[事件参数](https://www.visactor.io/vchart/api/API/event#%E4%BA%8B%E4%BB%B6%E5%8F%82%E6%95%B0)

## 快速上手

```tsx
import React, { useState } from 'react';
import { View } from '@tarojs/components';
import VChart from '@visactor/taro-vchart';

export function Pie() {
  // 1. 准备图表配置项与数据
  const [spec, setSpec] = useState({
    data: [
      {
        id: 'data1',
        values: [
          {
            value: 335,
            name: '直接访问'
          },
          {
            value: 310,
            name: '邮件营销'
          },
          {
            value: 274,
            name: '联盟广告'
          },
          {
            value: 235,
            name: '视频广告'
          },
          {
            value: 400,
            name: '搜索引擎'
          }
        ]
      }
    ],
    type: 'pie',
    outerRadius: 0.6,
    innerRadius: 0.5,
    categoryField: 'name',
    valueField: 'value',
    legends: {
      visible: true
    }
  });

  // 向Chart组件, 传递参数.
  return (
    <View
      style={{
        border: '1px solid #eeeeee',
        width: '90vw'
      }}
    >
      <VChart
        type="tt"
        spec={spec}
        canvasId="pie"
        style={{ height: '35vh', width: '100%' }}
        onChartInit={() => {
          console.log('init pie');
        }}
        onChartReady={() => {
          console.log('ready pie');
        }}
        onChartUpdate={() => {
          console.log('update pie');
        }}
      />
    </View>
  );
}
```

## 常用示例

### 图表状态更新

图表内部, 监听了 `spec` 的变化. 当 spec 变化时, 则会基于新的 `spec` 更新图表。

此外用户也可以使用 VChart 实例提供的渲染接口，进行图表的渲染、更新、销毁操作（可以通过 `onChartInit` 接口, 获取到 VChart 实例）。

下面是 VChart 实例上提供的较常用的 API：

- `chartInstance.renderAsync()` 渲染图表
- `chartInstance.release()` 销毁图表
- `chartInstance.updateSpec()` 基于 Spec 更新图表
- `chartInstance.updateData()` 基于数据更新图表

详细使用方法请参考:[VChart API](https://www.visactor.io/vchart/api/API/vchart)

#### 示例

兼容 React 的状态管理方式. 通过 setState 更新配置项, 图表即可重绘.

```tsx
import React, { useEffect, useState } from 'react';
import { View } from '@tarojs/components';
import VChart from '@visactor/taro-vchart';

export function Pie() {
  const [spec, setSpec] = useState({
    data: [
      {
        id: 'data1',
        values: [
          {
            value: 335,
            name: '直接访问'
          },
          {
            value: 310,
            name: '邮件营销'
          },
          {
            value: 274,
            name: '联盟广告'
          },
          {
            value: 235,
            name: '视频广告'
          },
          {
            value: 400,
            name: '搜索引擎'
          }
        ]
      }
    ],
    type: 'pie',
    outerRadius: 0.6,
    innerRadius: 0.5,
    categoryField: 'name',
    valueField: 'value',
    legends: {
      visible: true
    }
  });

  useEffect(() => {
    setTimeout(() => {
      setSpec({
        data: [
          {
            id: 'data1',
            values: [
              {
                value: 335,
                name: '直接访问'
              },
              {
                value: 310,
                name: '邮件营销'
              }
            ]
          }
        ],
        type: 'pie',
        outerRadius: 0.6,
        innerRadius: 0.5,
        categoryField: 'name',
        valueField: 'value',
        legends: {
          visible: true
        }
      });
    }, 3000);
  }, []);

  return (
    <View
      style={{
        border: '1px solid #eeeeee',
        width: '90vw'
      }}
    >
      <VChart
        type="tt"
        spec={spec}
        canvasId="pie"
        style={{ height: '35vh', width: '100%' }}
        onChartInit={() => {
          console.log('init pie');
        }}
        onChartReady={() => {
          console.log('ready pie');
        }}
        onChartUpdate={() => {
          console.log('update pie');
        }}
      />
    </View>
  );
}
```

## 如何开发

```bash
# 因为 taro-vchart 依赖 vchart 的编译结果，所以先要运行如下命令
$ rush run -p @visactor/vchart -s build:es5

# 运行 lark 小程序
$ rush run -p @visactor/taro-vchart -s dev:lark


# 运行微信小程序
$ rush run -p @visactor/taro-vchart -s dev:wx
```

然后使用飞书开发者工具导入 `packages/taro-vchart/dist/lark` 或者 `packages/taro-vchart/dist/weapp` 目录即可。
