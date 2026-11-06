{{ target: mark-progressive-config }}

#${prefix} large(boolean) = false

是否开启大数据渲染模式，开启后会降低渲染的精度。

#${prefix} largeThreshold(number)

开启大数据渲染优化的阀值，对应的是 data 的长度;推荐 largeThreshold < progressiveThreshold。

#${prefix} progressiveStep(number)

分片长度。

#${prefix} progressiveThreshold(number)

开启分片渲染的阀值，对应的是单系列 data 的长度。
