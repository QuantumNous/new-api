{{ target: common-select }}

<!-- ISelectSpec -->

#${prefix} select(Object|boolean)

图表 select 交互（选中）配置。 `select: false` 可直接关闭 select 交互。

##${prefix} enable(boolean) = true

select 交互开关，默认开启。

##${prefix} mode('single'|'multiple') = 'single'

选中模式配置，默认 `single` 单选。

- `'single'`: 单选
- `'multiple'`: 多选

##${prefix} trigger(string|string[]) = 'pointertap'

select 交互的触发事件配置。

{{ use: trigger-spec}}

##${prefix} triggerOff(string|string[])

select 交互的终止事件配置。

{{ use: trigger-spec}}
