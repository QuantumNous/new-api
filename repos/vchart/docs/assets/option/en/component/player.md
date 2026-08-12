{{ target: component-player }}

## player(Object)

The Player component is used to play a sequence data chart. It is commonly used for visualizing sequence data, allowing users to perform actions such as play, pause, fast forward, and rewind to help users observe data changes more intuitively.

### specs(Array)

Chart configuration for each item of the player, currently only supports setting data.

#### data(Array|Object)

Chart data can be a single data or a data array.

Here is a simple example:

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

User-defined ID. Default is not specified. If specified, it can be used to refer to other modules in the chart.

##### values(Array)

Data values can be a single data or a data array.

### type(string) = 'continuous'

Player type

- `continuous` Continuous
- `discrete` Discrete

### interval(number) = 1000

Playback interval

### totalDuration(number)

Total playback duration. This setting is mutually exclusive with interval. If total duration is configured, the playback interval will be recalculated based on the data length.

### direction(string) = 'default'

### auto(boolean) = false

Autoplay

### loop(boolean) = false

Loop playback

### alternate(boolean) = false

Alternate playback, only effective if the type is discrete. When the playback ends, it will change the playback direction.

Playback Direction

- `default` Default direction
  Horizontal direction, plays from left to right by default.
  Vertical direction, plays from top to bottom by default.
- `reverse` Reverse playback

### visible(boolean) = true

Component visibility configuration

### dx(number) = 0

X-axis offset

### dy(number) = 0

Y-axis offset

### width(number)

Component width

### height

Component height

### position(string)

Alignment

- `start` Start position
- `middle` Center
- `end` End position

### orient(string)

Component position

- `top`
- `right`
- `bottom`
- `left`

### slider

Slider configuration

#### visible(boolean) = true

Visibility control
visible?: boolean;

#### space(number) = 0

Spacing from the previous element

#### dx(number) = 0

X-axis offset

#### dy(number) = 0

Y-axis offset

#### railStyle(IRectMarkSpec)

Slider rail style

{{ use: graphic-rect(
  prefix = '####'
) }}

#### trackStyle(IRectMarkSpec)

Slider track style
{{ use: graphic-rect(
  prefix = '####'
) }}

#### handlerStyle(ISymbolMarkSpec)

Slider handle style
{{ use: graphic-symbol(
  prefix = '####'
) }}

### controller(Object)

Controller configuration

Here is a simple example:

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

Visibility control

#### start(Object)

Start button

{{use:player-controller-common(prefix = '####' )}}

##### style

{{ use: graphic-symbol(
  prefix = '#####'
)}}

#### pause(Object)

Pause button
{{use:player-controller-common(prefix = '####' )}}

##### style

{{ use: graphic-symbol(
  prefix = '#####'
)}}

#### backward(Object)

Rewind button
{{use:player-controller-common(prefix = '####' )}}

##### style

{{ use: graphic-symbol(
  prefix = '#####'
)}}

#### forward(Object)

Fast forward button
{{use:player-controller-common(prefix = '####' )}}

##### style

{{ use: graphic-symbol(
  prefix = '#####'
)}}
