{{ target: mark-point }}

<!-- ISymbolMarkSpec -->

#${prefix} visible(boolean) = true

是否显示标题。

<!-- #${prefix} shape(string)

同 symbolType。对外声明使用 shape，vrender 图形属性对应的是 shape。 -->

{{ use: graphic-symbol(
  prefix = ${prefix}
) }}
