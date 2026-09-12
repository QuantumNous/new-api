{{ target: common-select }}

<!-- ISelectSpec -->

#${prefix} select(Object|boolean)

Chart select interaction (selection) configuration. `select: false` can directly disable select interaction.

##${prefix} enable(boolean) = true

Select interaction switch, enabled by default.

##${prefix} mode('single'|'multiple') = 'single'

Selection mode configuration, default is `single` selection.

- `'single'`: Single selection
- `'multiple'`: Multiple selection

##${prefix} trigger(string|string[]) = 'pointertap'

Configuration of trigger events for select interaction.

{{ use: trigger-spec}}

##${prefix} triggerOff(string|string[])

Configuration of termination events for select interaction.

{{ use: trigger-spec}}
