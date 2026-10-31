{{ target: marks-animate }}

#${prefix} type(string)

Animation execution type, specify a specific built-in animation execution effect

General built-in animation types include:

- `fadeIn`/`fadeOut`: Fading in and out animation
- `scaleIn`/`scaleOut`: Scaling in and out animation
- `moveIn`/`moveOut`: Moving in and out animation
- `rotateIn`/`rotateOut`: Rotation animation
- `update`: Update animation

{{ if: ${type} === 'rect' | ${name} === 'bar' | ${name} === 'node'| ${name} === 'leaf' | ${name} === 'nonLeaf' }}

${name} mark supports additional animation types, including:

- `growHeightIn`/`growHeightOut`: Height growth animation
- `growWidthIn`/`growWidthOut`: Width growth animation
- `growCenterIn`/`growCenterOut`: Center growth animation

{{ elif: ${type} === 'arc' | ${name} === 'pie' | ${name} === 'rose' | ${name} === 'sunburst' }}

${name}mark supports additional animation types, including:

- `growRadiusIn`/`growRadiusOut`: Radius growth animation
- `growAngleIn`/`growAngleOut`: Angle growth animation

{{ elif: ${type} === 'line' | ${type} === 'area' }}

${name} mark supports additional animation types, including:

- `growPointsIn`/`growPointsOut`: Point growth animation
- `growPointsXIn`/`growPointsXOut`: X-direction point growth animation
- `growPointsYIn`/`growPointsYOut`: Y-direction point growth animation
- `clipIn`/`clipOut`: Clipping animation

{{ elif: ${type} === 'interval' }}

${name} mark supports additional animation types, including:

- `growIntervalIn`/`growIntervalOut`: Growth animation

{{ elif: ${type} === 'polygon'  | ${name} === 'funnel' | ${transform} === 'funnel' }}

${name} mark supports additional animation types, including:

- `growPointsIn`/`growPointsOut`: Point growth animation

{{ /if }}

#${prefix} channel(object|array)

Visual channels before and after animation execution, conflicting with the `type` configuration.

#${prefix} custom(ACustomAnimate)

Custom animation, which replaces the default visual channel interpolation logic if a custom animation configuration is set.

#${prefix} customParameters

Custom animation parameters.

#${prefix} easing(string|EasingTypeFunc)

Animation easing, default to `'quintInOut'`.

#${prefix} delay(number)

Animation execution delay, default to 0.

#${prefix} duration(number)

Animation execution duration.

#${prefix} oneByOne(number|boolean)

Animation delay duration for each execution, if set to `true`, the next element's animation will be executed after the previous element's animation ends, default to `false`

#${prefix} startTime(number)

Animation execution initial time, which will not be applied repeatedly in loop animations, default to 0

#${prefix} totalTime(number)

Maximum animation execution time, which will be terminated when the animation execution reaches the set time.

#${prefix} loop(number|boolean)

Animation loop count, if set to `true`, it will loop infinitely

#${prefix} options(object)

Additional parameters set for specific animation types.

#${prefix} controlOptions(object)

Animation execution logic control parameters:

- `stopWhenStateChange`: Whether to immediately terminate the own animation when the animation state changes.
- `immediatelyApply`: Whether to immediately apply the animation's initial visual channel.
