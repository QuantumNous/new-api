{{ target: marks-animate }}

#${prefix} type(string)

动画执行类型，指定特定的内置动画执行效果

通用的内置动画类型包括：

- `fadeIn`/`fadeOut`: 渐入渐出动画
- `scaleIn`/`scaleOut`: 缩放动画
- `moveIn`/`moveOut`: 移入移出动画
- `rotateIn`/`rotateOut`: 旋转动画
- `update`: 更新动画

{{ if: ${type} === 'rect' | ${name} === 'bar' | ${name} === 'node'| ${name} === 'leaf' | ${name} === 'nonLeaf' }}

${name} 图元支持的额外动画类型包括：

- `growHeightIn`/`growHeightOut`: 高度生长动画
- `growWidthIn`/`growWidthOut`: 宽度生长动画
- `growCenterIn`/`growCenterOut`: 中心生长动画

{{ elif: ${type} === 'arc' | ${name} === 'pie' | ${name} === 'rose' | ${name} === 'sunburst' }}

${name}图元支持的额外动画类型包括：

- `growRadiusIn`/`growRadiusOut`: 半径生长动画
- `growAngleIn`/`growAngleOut`: 角度生长动画

{{ elif: ${type} === 'line' | ${type} === 'area' }}

${name} 图元支持的额外动画类型包括：

- `growPointsIn`/`growPointsOut`: 点生长动画
- `growPointsXIn`/`growPointsXOut`: X 方向点生长动画
- `growPointsYIn`/`growPointsYOut`: Y 方向点生长动画
- `clipIn`/`clipOut`: 裁剪动画

{{ elif: ${type} === 'interval' }}

${name} 图元支持的额外动画类型包括：

- `growIntervalIn`/`growIntervalOut`: 生长动画

{{ elif: ${type} === 'polygon'  | ${name} === 'funnel' | ${transform} === 'funnel' }}

${name} 图元支持的额外动画类型包括：

- `growPointsIn`/`growPointsOut`: 点生长动画

{{ /if }}

#${prefix} channel(object|array)

动画执行前后的视觉通道，与 `type` 配置冲突

#${prefix} custom(ACustomAnimate)

自定义动画，如果设定了自定义动画配置则会替换默认的视觉通道插值逻辑

#${prefix} customParameters

自定义动画参数

#${prefix} easing(string|EasingTypeFunc)

动画缓动，默认为 `'quintInOut'`

#${prefix} delay(number)

动画执行的延迟时间，默认为 0

#${prefix} duration(number)

动画执行时长

#${prefix} oneByOne(number|boolean)

动画依次执行的延迟时长，如果配置为 `true` 则会在上一个元素动画执行结束后执行下一个元素的动画，默认为 `false`

#${prefix} startTime(number)

动画执行的初始时间，这一初始时间不会在循环动画中被重复应用，默认为 0

#${prefix} totalTime(number)

动画执行的最大时间，如果动画执行到达设定时间将会被终止

#${prefix} loop(number|boolean)

动画循环次数，如果配置为 `true` 则会无限循环

#${prefix} options(object)

特定动画类型执行时设定的额外参数

#${prefix} controlOptions(object)

动画执行逻辑的控制参数：

- `stopWhenStateChange`: 当动画状态变更时是否立即终止自身动画
- `immediatelyApply`: 是否立即应用动画初始的视觉通道
