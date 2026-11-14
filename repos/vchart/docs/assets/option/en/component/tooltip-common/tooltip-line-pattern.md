{{ target: component-tooltip-line-pattern }}

<!-- ITooltipLinePattern -->

#${prefix} visible(boolean) = true

Whether the current line is displayed.

{{ if: ${content} }}
#${prefix} key(string|Function)

The content of the key column for the current line of the tooltip. If configured as a string, it will be displayed as the corresponding constant text.

{{ if: ${supportFunction} }}

It can also be configured as a function callback, with the type:

```ts
(datum: Datum) => string;
```

Where `datum` is the default data item corresponding to the current line of the tooltip.

To read the content of a specific field in the data item, you can set `field` as follows:

```ts
// (supported since 1.13.0)
{
  field: string;
}
```

{{ /if }}

#${prefix} keyTimeFormat(string) = '%Y%m%d'

Time conversion format of key label.

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

#${prefix} keyTimeFormatMode(string) = 'local'

Time conversion mode of key label. Support `'utc' | 'local'` mode.

#${prefix} keyFormatter(string)

Formatter string template, supported since version `1.10.0`.

The string template with the variable name wrapped in `{}`, the variable name is taken from the data attribute value.

For example: `keyFormatter: '{time:%B %d,%Y}'`

For detailed usage, please refer to the [Tutorial Document](/vchart/guide/tutorial_docs/Chart_Plugins/Formatter) and [Demo](/vchart/demo/label/label-formatter).

{{ /if }}

#${prefix} value(string|Function|Object)

tooltip The contents of the value column of the current row.
If configured as a string, it will be displayed as the corresponding constant text.
It can also be configured as rich text configuration, the type is:

```ts
{
    /**
     * Main title text type (default type is text)
     * text, rich
     */
    type?: string;
    /**
     * Title text content
     * - Support rich text configuration
     */
    text?: IRichTextCharacter[] | string;
}
```

{{ if: ${supportFunction} }}

It can also be configured as a function callback, the type is:

```ts
(datum: Datum) => string;
```

Where `datum` is the default data item corresponding to the current line of the tooltip.

To read the content of a specific field in the data item, you can set `field` as follows:

```ts
// (supported since 1.13.0)
{
  field: string;
}
```

{{ /if }}

#${prefix} valueTimeFormat(string) = '%Y%m%d'

Time conversion format of value label.

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

#${prefix} valueTimeFormatMode(string) = 'local'

Time conversion mode of value label. Support `'utc' | 'local'` mode.

#${prefix} valueFormatter(string)

Formatter string template, supported since version `1.10.0`.

The string template with the variable name wrapped in `{}`, the variable name is taken from the data attribute value.

For example: `valueFormatter: '{count:~s}'`

For detailed usage, please refer to the [Tutorial Document](/vchart/guide/tutorial_docs/Chart_Plugins/Formatter) and [Demo](/vchart/demo/label/label-formatter).

{{ if: ${content} }}

{{ if: ${supportFunction} }}

{{ use: component-tooltip-shape-pattern(
  prefix = ${prefix},
  type = 'pattern'
) }}

{{ else }}

{{ use: component-tooltip-shape-pattern(
  prefix = ${prefix},
  type = 'style'
) }}

{{ /if }}

{{ /if }}
