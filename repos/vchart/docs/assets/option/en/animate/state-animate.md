{{ target: animate-state-animate }}

<!-- IStateAnimateSpec -->

{{ if: !${noPreset} }}

{{ var: presetType = ${preset} ?  ${preset} : 'string' }}
{{ var: defaultPresetType = ${defaultPreset} ?  ${defaultPreset} : 'fadeIn' }} #${prefix} preset(${presetType}) = '${defaultPresetType}'

Preset animation effects.

{{ /if }}

{{ if: ${seriesType} === 'wordCloud' }}
#${prefix} duration(number) = 200
Chart animation duration.
In wordCloud series:

- When the preset is 'scaleIn', the duration is the reference duration of animation for a single word in the word cloud. If there are too many words, it will be adjusted dynamically based on the count of words and the `totalTime` config.
- When the preset is 'fadeIn', it is the total animation duration and is defaulted as 1000ms.

{{ else }}

#${prefix} duration(number) = ${defaultDuration}

Chart animation duration.
{{ /if }}

#${prefix} delay(number) = 0

The time to delay the start of the animation.

#${prefix} easing(string) = '${defaultEasing}'

Animation easing effect. Default built-in effect types include: 'linear', 'quadIn', 'quadOut', 'quadInOut', 'quadInOut', 'cubicIn', 'cubicOut', 'cubicInOut', 'quartIn', 'quartOut', 'quartInOut', 'quintIn', 'quintOut', 'quintInOut', 'backIn', 'backOut', 'backInOut', 'circIn', 'circOut', 'circInOut', 'bounceOut', 'bounceIn', 'bounceInOut', 'elasticIn', 'elasticOut', 'elasticInOut'.

{{ if: !${noOneByOne} }}
#${prefix} oneByOne(boolean) = false

Whether to execute in sequence.
{{ /if }}

{{ if: ${seriesType} === 'wordCloud' }}
#${prefix} totalTime(number) = 1000

The total duration of animation execution. It is currently only supported when the default entry animation (preset = 'scaleIn') in the word cloud series is configured.
{{ /if }}
