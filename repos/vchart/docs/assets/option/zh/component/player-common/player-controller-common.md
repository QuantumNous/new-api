{{ target: player-controller-common }}

#${prefix} space(number)
当前元素与前一个元素的间隔。

#${prefix} order(number)

指定按钮顺序，默认均为 0。

- 水平方向，默认从左到右，依次为：播放(暂停)按钮、后退按钮、前进按钮。
- 垂直方向，默认从上到下，依次为：播放(暂停)按钮、后退按钮、前进按钮。

#${prefix} position(string)

按钮在开始位置或在起始位置。

- `start` 起始位置，滑动条的起点一侧。
- `end` 结束位置，滑动条的终点一侧。
