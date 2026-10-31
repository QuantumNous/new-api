{{ target: component-time-axis }}

<!-- ICartesianTimeAxisSpec -->
{{ use: component-linear-axis(
  prefix = ${prefix}
) }}

#${prefix} layers(Array)
Hierarchical configuration of axes. Currently only supports single layer/double layer, ie layers.length <= 2.
Among them, `layer[0]` is the main axis, which is the axis closest to the coordinate axis.

##${prefix} tickStep(number)

tick interval.

##${prefix} timeFormat(string) = '%Y%m%d'

Time conversion format.

| **Date Granularity** | **Format Configuration** | **Date Content**            | **Example** | **Numerical Range** |
| -------------------- | ------------------------ | --------------------------- | ----------- | ------------------- |
| Year                 | %Y                       | Full year name              | 2022        |                     |
| month                | %b                       | abbreviated month           | Jul         |                     |
|                      | %B                       | full name of the month      | July        |                     |
|                      | %m                       | month                       | 7           | [01, 12]            |
| week                 | %a                       | abbreviated week            | Wed         |                     |
|                      | %A                       | full name of the week       | Wednesday   |                     |
| day                  | %d                       | day with 0-padded digits    | 1           | [01, 31]            |
|                      | %e                       | blank-padded days of digits | 1           | [ 1, 31]            |
| hour                 | %H                       | 24-hour format hour         | 1           | [00, 23]            |
|                      | %I                       | 12-hour format hour         | 1           | [01, 12]            |
|                      | %p                       | AM or PM                    | AM          |                     |
| minutes              | %M                       | minutes                     | 0           | [00, 59]            |
| seconds              | %S                       | seconds                     | 0           | [00, 61]            |
| milliseconds         | %L                       | milliseconds                | 1           | [000, 999]          |

##${prefix} timeFormatMode(string) = 'local'

Time conversion mode. Support `'utc' | 'local'` mode.

##${prefix} tickCount(string) = 10

The desired number of consecutive axis ticks.

##${prefix} forceTickCount(string) = 10

Mandatory set the number of ticks.
