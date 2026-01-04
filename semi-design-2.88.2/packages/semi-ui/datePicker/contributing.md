# 输入与输出

## value

```typescript
/** 范围选择时为数组 */
export type ValueType = BaseValueType | BaseValueType[];
export type BaseValueType = string | number | Date;
```

它的值是 UTC 时间，无论是时间戳还是 Date 对象，都是一个固定的值。

如果涉及到时区，不要传字符串。

## onChange

```typescript
export type OnChangeType = (date?: Date | Date[] | string | string[], dateStr?: string | string[] | Date | Date[]) => void;
```

onChange 第一个参数在一般场景下，是 `Date | Date[]` 类型，如果传入了 onChangeWithDateFirst false，则会变为字符串类型，这样做是为了兼容 Semi 1.x。

# 时区

## 输入、输出与时区

输入是时间戳或者代表 UTC 时间的 Date，输出是代表 UTC 时间的 Date。

输入、输出是统一时间，没有时区概念，在 DatePicker 内部使用计算机时间，方便 new Date 以及时间的计算。

## state.value

保存的是计算机所在时区选择的时间。

保存为计算机所在时区时间的好处是，DatePicker 内部处理时间时不需要考虑时区问题，例如 new Date()。


### 由 props.value 生成 state.value

例如用户传入了 UTC +0 时区的时间，2023-03-29 10:00，传到 state.value 时，我们会转换为 UTC +8 时区的 2023-03-29 18:00

### 由 selected value 生成 state.value

假设我们通过点击日期面板选择了这样一个日期。

<img src="https://lf26-static.semi.design/obj/semi-tos/images/1cc64310-ce34-11ed-9ed7-2f6eb48d2fe5.png" height="513px" />

state.value 实际保存就是当前时区下的 2023-03-15 21:17:33。

<img src="https://lf6-static.semi.design/obj/semi-tos/images/5bb8c390-ce34-11ed-9065-17bca335ab32.png" height="256px">

## onChange

onChange 时，我们会将 zone time 转换为 UTC 时间。

## 时区转化

### 计算机时间 -> UTC 时间

给定一个计算机时间以及一个目标的时区，转换为该目标时区下选择对应时间的 UTC 时间。

```javascript
import { zonedTimeToUtc } from 'date-fns-tz'

const date = getDatePickerValue() // e.g. 2014-06-25 10:00:00 (picked in any time zone)
const timeZone = getTimeZoneValue() // e.g. America/Los_Angeles

const utcDate = zonedTimeToUtc(date, timeZone) // In June 10am in Los Angeles is 5pm UTC

postToServer(utcDate.toISOString(), timeZone) // post 2014-06-25T17:00:00.000Z, America/Los_Angeles
```

### UTC时间 -> 计算机时间

给定一个 UTC 时间以及一个目标时区，将 UTC 时间转换为该时刻下目标时区的时间。

```javascript
import { utcToZonedTime } from 'date-fns-tz'

const { isoDate, timeZone } = fetchInitialValues() // 2014-06-25T10:00:00.000Z, America/New_York

const date = utcToZonedTime(isoDate, timeZone) // In June 10am UTC is 6am in New York (-04:00)

renderDatePicker(date) // 2014-06-25 06:00:00 (in the system time zone)
renderTimeZoneSelect(timeZone) // America/New_York
```

# 时区案例

## 展示时间

props.value 传入一个时间戳，代表的时间是 UTC +0 2023-03-29 10:00。

在 0 时区应该展示什么？10 时。代表的就是 0 时区的人在 10 时选择了日期，就应该展示 10 时。

展示时间会受到计算机时区的影响。

## 设置时区

props.value 传入一个时间戳，代表的时间是 UTC +0 2023-03-29 10:00。

设置 DatePicker 时区为 UTC +2，这时应该展示 12 时。

设置时区时，展示的时间与设置的时区有关，与用户计算机时区无关。

## 在非本时区选择时间

例如我在 UTC +8，timeZone 设置为 UTC +0，选择日期 2023-03-29 10:00。

<img height="532px" src="https://lf6-static.semi.design/obj/semi-tos/images/3d93c580-ce30-11ed-9ed7-2f6eb48d2fe5.png" />

这时 onChange 的 value 应该就是 UTC +0 当日 10 时的时间。

本地打印的话，会是 2023-03-29 18:00，因为我们是 UTC +8。

<img height="142px" src="https://lf9-static.semi.design/obj/semi-tos/images/bd14c340-ce30-11ed-b92e-7f00557e9227.png" />

## 切换时区

选择了 UTC +0 2023-03-29 10:00，切换时区为 UTC +1。DatePicker 应该怎么展示？

输入框应该展示 2023-03-29 11:00。相当于我们传入了一个 UTC 时间，需要转换为对应时区下的时间。

<img height="172px" src="https://lf9-static.semi.design/obj/semi-tos/images/0f978120-ce31-11ed-9ed7-2f6eb48d2fe5.png" />
