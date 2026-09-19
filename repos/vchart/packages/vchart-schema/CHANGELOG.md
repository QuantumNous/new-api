# Change Log - @visactor/vchart-schema

This log was last generated on Tue, 15 Aug 2023 07:25:04 GMT and should not be manually modified.

## 1.2.1
Tue, 15 Aug 2023 07:25:04 GMT

### Patches

- feat: the api updateViewBox adds the relayout parameter, which supports not redrawing the chart immediately after updateViewbox, details in #497


- fix(axis-layout): fix the problem that the axis-component cannot take effect after configuring minWidth and maxWidth, details are in #379


- fix(axis-layout): fix the issue of axis move slighty when manual legend filtering, details are in #426


- fix: fix the issue about when axis.label is autoLimit, the chart layout can not work as expect after resize, details in #429



## 1.2.0
Thu, 10 Aug 2023 05:23:25 GMT

### Patches

- feat: supplement sync methods in vchart instance


- perf(axis-tick): optimize the calculation times of axis ticks, optimize the discrete axis sampling algorithm


- perf(data): remove redundant data statistics calculations



