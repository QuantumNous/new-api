# Formatter Plugin

Starting from `v1.10.0`, VChart supports the formatting extension plugin, providing more capabilities for formatting strings, including:

1. Numeric formatting
2. Time formatting
3. Data variable replacement

## How to use the formatting plugin

The formatted string supports replacement with data content, and the variable name needs to be enclosed in single braces `{}`, for example:

```js
// Data
{
  year: 2016,
  population: 899447
},

formatter: `"The population in {year} year is {population}"`。
```

### Numeric

The numeric formatting adopts a formatting convention similar to [d3-formatter](https://d3js.org/d3-format). In the formatting expression, it is separated from the variable name by a colon, for example:

- Two decimal places: `{value:.2f}`
- Thousands separator, no decimal places:`{value:,.0f}`
- Thousands separator, one decimal place: `{value:,.1f}`

Common formatting types include:

- `e`: exponent notation.
- `f`: fixed point notation.
- `g`: either decimal or exponent notation, rounded to significant digits.
- `r`: decimal notation, rounded to significant digits.
- `s`: decimal notation with an SI prefix, rounded to significant digits.
- `%`: multiply by 100, and then decimal notation with a percent sign.
- `p`: multiply by 100, round to significant digits, and then decimal notation with a percent sign.
- `b`: binary notation, rounded to integer.
- `o`: octal notation, rounded to integer.
- `d`: decimal notation, rounded to integer.
- `x`: hexadecimal notation, using lower-case letters, rounded to integer.
- `X`: hexadecimal notation, using upper-case letters, rounded to integer.
- `c`: character data, for a string of text.

In addition, the formatting plugin has extended two common numeric formatting logics:

- `t`：keep the specified number of decimal places, **without** round off.
- `z`：decimal value, rounded to significant digits; integer value, no decimal part.

For example:

```js
// Data
{
  value: 12.3893333;
  value2: 100;
}

formatter: '{value:.2f}'; // "12.39"
formatter: '{value:.2t}'; //  "12.38"

formatter: '{value:.2z}'; //  "12.39"
formatter: '{value2:.2z}'; //  "100"
```

The `~` option trims insignificant trailing zeros across all format types. This is most commonly used in conjunction with types `r`, `e`, `s` and `%`. For example:

```js
// 数据
{
  value: 1500;
}

formatter: '{value:s}'; // "1.50000k"
formatter: '{value:~s}'; //  "1.5k"
```

### Time

Like numbers, dates also allow adding formats after the colon. The allowed format conventions are similar to [d3-time-format](https://d3js.org/d3-time-format). For example:

```js
// Date
{
  date: +new Date(2024, 5, 1);
}

// Full date: %Y-%m-%d
formatter: '{date:%Y-%m-%d}'; // "2024-05-01"
```

Common date formatting configurations:

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

## How to introduce the formatting plugin on demand?

When using VChart through on-demand loading, the formatting plugin needs to be manually registered:

```js
import { VChart } from '@visactor/vchart';
import { registerFormatPlugin } from '@visactor/vchart';

VChart.useRegisters([registerFormatPlugin]);
```
