{{ target: component-player }}

## player(Object)

Player 组件用于播放序列数据的图表，该组件通常用于可视化序列数据，支持用户对数据进行播放、暂停、快进、后退等操作，帮助用户更加直观地观察数据的变化。

### specs(Array)

播放器每一项的图表配置，目前仅支持配置 data。

#### data(Array|Object)

图表数据，可以是单个数据也可以是一个数据数组。

一个简单的示例如下：

```ts
const spec = {
  player: {
    specs: [
      {
        // 第一项spec的数据配置
        data: {
          id: 'dataId',
          values: [
            { date: '2022', name: 'IE', value: 59.1 },
            { date: '2022', name: 'Edge', value: 59.1 }
          ]
        }
      },
      {
        // 第二项spec的数据配置
        data: {
          id: 'dataId',
          values: [
            { date: '2023', name: 'IE', value: 9.95 },
            { date: '2023', name: 'Edge', value: 49.93 }
          ]
        }
      }
    ]
  }
};
```

##### id(string)

用户设定 ID。默认不指定，指定则可用于在图表其他模块中引用。

##### values(Array)

数据值，可以是单个数据也可以是一个数据数组。

### type(string) = 'continuous'

播放器类型

- `continuous` 连续型
- `discrete` 离散型

### interval(number) = 1000

播放间隔

### totalDuration(number)

播放总时长，该配置与 interval 互斥，若配置总时长，则会根据数据长度重新计算播放间隔。

### direction(string) = 'default'

### auto(boolean) = false

自动播放

### loop(boolean) = false

循环播放

### alternate(boolean) = false

交替播放，仅在离散播放器中生效，播放结束后会更换播放方向。

播放方向

- `default` 默认方向
  水平方向，默认`从左到右`播放。
  垂直方向，默认`从上到下`播放。
- `reverse` 逆向播放

### visible(boolean) = true

组件显隐配置

### dx(number) = 0

x 方向偏移

### dy(number) = 0

y 方向偏移

### width(number)

组件宽度

### height

组件高度

### position(string)

对齐方式

- `start` 起始位置
- `middle` 居中
- `end` 结束位置

### orient(string)

组件位置

- `top`
- `right`
- `bottom`
- `left`

### slider

滑动条配置

#### visible(boolean) = true

显隐控制
visible?: boolean;

#### space(number) = 0

与前一个元素的间隔

#### dx(number) = 0

x 方向的偏移

#### dy(number) = 0

y 方向的偏移

#### railStyle(IRectMarkSpec)

滑动轨道样式

{{ use: graphic-rect(
  prefix = '####'
) }}

#### trackStyle(IRectMarkSpec)

滑动轨迹样式
{{ use: graphic-rect(
  prefix = '####'
) }}

#### handlerStyle(ISymbolMarkSpec)

滑动手柄样式
{{ use: graphic-symbol(
  prefix = '####'
) }}

### controller(Object)

控制器配置

一个简单示例如下：

```ts
const spec = {
  player: {
    controller: {
      visible: true,
      start: { order: 3, position: 'start', space: 0, style: { fill: 'red' } },
      pause: { order: 3, position: 'start', space: 0, style: { fill: 'blue' } },
      forward: { order: 2, position: 'start', space: 30, style: { fill: 'green' } },
      backward: { order: 1, position: 'start', space: 30, style: { fill: 'pink' } }
    }
  }
};
```

#### visible(boolean) = true

显隐控制

#### start(Object)

开始按钮

{{use:player-controller-common(prefix = '####' )}}

##### style

{{ use: graphic-symbol(
  prefix = '#####'
)}}

#### pause(Object)

暂停按钮
{{use:player-controller-common(prefix = '####' )}}

##### style

{{ use: graphic-symbol(
  prefix = '#####'
)}}

#### backward(Object)

后退按钮
{{use:player-controller-common(prefix = '####' )}}

##### style

{{ use: graphic-symbol(
  prefix = '#####'
)}}

#### forward(Object)

前进按钮
{{use:player-controller-common(prefix = '####' )}}

##### style

{{ use: graphic-symbol(
  prefix = '#####'
)}}
