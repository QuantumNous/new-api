{{ target: common-drill }}

#${prefix} drill(boolean) = false

下钻功能开关

#${prefix} drillField(string)

下钻依据的字段， 默认情况会使用自动生成 unique key, 但在使用 API 钻取时需要配置`drillField`。
