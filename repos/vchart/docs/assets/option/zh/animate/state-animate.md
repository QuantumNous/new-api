{{ target: animate-state-animate }}

<!-- IStateAnimateSpec -->

{{ if: !${noPreset} }}

{{ var: presetType = ${preset} ?  ${preset} : 'string' }}
{{ var: defaultPresetType = ${defaultPreset} ?  ${defaultPreset} : 'fadeIn' }} #${prefix} preset(${presetType}) = '${defaultPresetType}'

预设动画效果。

{{ /if }}

{{ if: ${seriesType} === 'wordCloud' }}
#${prefix} duration(number) = 200
图表动画时长。
在词云中：

- 默认出场动画效果 （preset 为 'scaleIn'）时，duration 为词云中单个词的动画参考时长。当单词数过多，会根据单词总数和总动画时长（totalTime 配置）进行动态调整。
- preset 为 'fadeIn' 时，则为总动画时长，默认为 1000 ms。

{{ else }}

#${prefix} duration(number) = ${defaultDuration}
{{ /if }}

图表动画时长。

#${prefix} delay(number) = 0

动画延迟开始的时长。

#${prefix} easing(string) = '${defaultEasing}'

动画缓动效果。默认内置效果类型有：'linear', 'quadIn', 'quadOut', 'quadInOut', 'quadInOut', 'cubicIn', 'cubicOut', 'cubicInOut', 'quartIn', 'quartOut', 'quartInOut', 'quintIn', 'quintOut', 'quintInOut', 'backIn', 'backOut', 'backInOut', 'circIn', 'circOut', 'circInOut', 'bounceOut', 'bounceIn', 'bounceInOut', 'elasticIn', 'elasticOut', 'elasticInOut'。

{{ if: !${noOneByOne} }}
#${prefix} oneByOne(boolean) = false

是否轮流执行。
{{ /if }}

{{ if: ${seriesType} === 'wordCloud' }}
#${prefix} totalTime(number) = 1000

动画执行总时长。目前仅在词云系列默认出场动画(preset = 'scaleIn')时支持配置。
{{ /if }}
