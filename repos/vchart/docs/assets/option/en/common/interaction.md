{{ target: common-interaction }}

#${prefix} interactions(Array)

From version @1.9.0, the configuration format is as follows:

```ts
{
  interactions: [
    {
      type: 'element-active'
    }
  ];
}
```

Specific supported interaction types will be introduced later:

##${prefix} markIds(Array)

Specify the element IDs that trigger the interaction. If not provided, the default elements of each series will trigger the interaction.

##${prefix} markNames(Array)

Specify the element names that trigger the interaction. If not provided, the default elements of each series will trigger the interaction. For example, in the area chart, if you only want to affect the lines and filled areas, you can configure as follows:

```
markNames: ['line', 'area']
```

Note that if both markIds and markNames are set for the interaction, markIds take precedence.

##${prefix} type(string)

Set the type of interaction

##${prefix} type.element-acitve

Set the element's state to active

###${prefix} state(string) = 'active'

The state name corresponding to the active state

###${prefix} trigger(string | string[]) = 'pointerover'

Configuration of the trigger event for the interaction

{{ use: element-active-trigger}}

###${prefix} triggerOff(string | string[]) = 'pointerout'

Configuration of the end event for the interaction

{{ use: element-active-trigger}}

##${prefix} type.element-highlight

Element highlight interaction, sets the state of the triggered element to highlighted, and the state of other elements to blurred; note that this interaction is not recommended to be used simultaneously with the default 'hover' interaction

###${prefix} highlightState(string) = 'highlight'

The state name corresponding to the highlighted state

###${prefix} blurState(string) = 'blur'

The state name corresponding to the blurred state

###${prefix} trigger(string | string[]) = 'pointerover'

Configuration of trigger events for interaction

{{ use: element-active-trigger}}

###${prefix} triggerOff(string | string[]) = 'pointerout'

Configuration of termination events for interaction

{{ use: element-active-trigger}}

##${prefix} type.element-select

Element selection interaction, which sets the element's state to selected; note that this interaction is not recommended to be used simultaneously with the default `select` interaction

###${prefix} state(string) = 'selected'

State name corresponding to the selected state

###${prefix} isMultiple(boolean) = true

Whether multiple selections are supported

###${prefix} trigger(string | string[]) = 'click'

Configuration of trigger events for interaction

{{ use: element-active-trigger}}

###${prefix} triggerOff(string | number | string[]) = 'pointerout'

Configuration of termination events for interaction; supported configurations include:

- 'empty': click on blank space
- number: timed clearing of selected state
- other event names

{{ use: element-active-trigger}}

##${prefix} type.element-highlight-by-legend

Legend triggers element highlighting and blur state

###${prefix} filterType('groupKey' | 'key') = 'groupKey'

When querying the highlighted elements corresponding to the legend, filter the type of highlighted elements, supporting two configurations:

- `'groupKey'` when the group key is the same as the legend key, highlight the element, such as highlighting a line through the legend in a line chart
- `'key'` when the graphic key is the same as the legend key, highlight the element, such as highlighting a sector through the legend in a pie chart; note that it needs to be used in conjunction with the `dataKey` configuration in the series

###${prefix} filterField(string)

Match the field corresponding to the graphic data with the legend item's `key` value

Legend triggers element highlighting and blur state

###${prefix} highlightState(string) = 'highlight'

State name corresponding to the highlighted state

###${prefix} blurState(string) = 'blur'

State name corresponding to the blurred state

###${prefix} trigger(string | string[]) = 'pointerover'

Configuration of trigger events for interaction

{{ use: element-active-trigger}}

###${prefix} triggerOff(string | string[]) = 'pointerout'

Configuration of termination events for interaction

{{ use: element-active-trigger}}

##${prefix} type.element-active-by-legend

Legend triggers element activation state

###${prefix} filterType('groupKey' | 'key') = 'groupKey'

When querying the highlighted elements corresponding to the legend, filter the type of highlighted elements, supporting two configurations:

- `'groupKey'` when the group key is the same as the legend key, highlight the element, such as highlighting a line through the legend in a line chart
- `'key'` when the graphic key is the same as the legend key, highlight the element, such as highlighting a sector through the legend in a pie chart; note that it needs to be used in conjunction with the `dataKey` configuration in the series

###${prefix} filterField(string)

Match the field corresponding to the graphic data with the legend item's `key` value

###${prefix} state(string) = 'active'

State name corresponding to the activated state

###${prefix} trigger(string | string[]) = 'pointerover'

Configuration of trigger events for interaction

{{ use: element-active-trigger}}

###${prefix} triggerOff(string | string[]) = 'pointerout'

Configuration of termination events for interaction

{{ use: element-active-trigger}}

##${prefix} type.element-highlight-by-group

Sets the state of the triggering element and elements with the same group value (`groupKey`) as the triggering element to highlighted, and sets the state of other elements to blurred

###${prefix} highlightState(string) = 'highlight'

State name corresponding to the highlighted state

###${prefix} blurState(string) = 'blur'

State name corresponding to the blurred state

###${prefix} trigger(string | string[]) = 'pointerover'

Configuration of trigger events for interaction

{{ use: element-active-trigger}}

###${prefix} triggerOff(string | string[]) = 'pointerout'

Configuration of termination events for interaction

{{ use: element-active-trigger}}

##${prefix} type.element-highlight-by-key

Sets the state of the triggering element and elements with the same `key` as the triggering element to highlighted, and sets the state of other elements to blurred; generally needs to be used in conjunction with the `dataKey` configuration in the series

###${prefix} highlightState(string) = 'highlight'

State name corresponding to the highlighted state

###${prefix} blurState(string) = 'blur'

State name corresponding to the blurred state

###${prefix} trigger(string | string[]) = 'pointerover'

Configuration of trigger events for interaction

{{ use: element-active-trigger}}

###${prefix} triggerOff(string | string[]) = 'pointerout'

Configuration of termination events for interaction

{{ use: element-active-trigger}}

##${prefix} type.element-highlight-by-name

Filter the triggering element based on `graphicName`, filter the highlighted elements based on `filterType` or `filterField`, set the highlighted elements to the highlighted state, and set other elements to the blurred state

###${prefix} graphicName(string|Array)

The `name` value of the triggering element; note that this `name` value is internally generated by vchart; the currently supported configurations include:

- `'axis-label'` axis label

###${prefix} parseData(Function)

Parse the value corresponding to the triggering element and use this value to match the highlighted elements;
For elements of type `text`, we will read the `text` attribute as the matching value;

###${prefix} filterType('groupKey' | 'key') = 'groupKey'

Filter the type of highlighted elements, supporting two configurations:

- `'groupKey'` when the group key is the same as the legend key, highlight the element, such as highlighting a line through the legend in a line chart
- `'key'` when the graphic key is the same as the legend key, highlight the element, such as highlighting a sector through the legend in a pie chart; note that it needs to be used in conjunction with the `dataKey` configuration in the series

###${prefix} filterField(string)

Match the field corresponding to the graphic data with the triggering element

###${prefix} highlightState(string) = 'highlight'

State name corresponding to the highlighted state

###${prefix} blurState(string) = 'blur'

State name corresponding to the blurred state

###${prefix} trigger(string | string[]) = 'pointerover'

Configuration of trigger events for interaction

{{ use: element-active-trigger}}

###${prefix} triggerOff(string | string[]) = 'pointerout'

{{ use: element-active-trigger}}

Configuration of termination events for interaction

##${prefix} type.element-highlight-by-graphic-name

Read the graphic name, set the state of all graphics with the same name to highlight, and set the state of other elements to blur; note that this interaction is not recommended to be used with the default `hover` interaction (except for pictorial charts).

###${prefix} highlightState(string) = 'highlight'

The state name corresponding to the highlight state.

###${prefix} blurState(string) = 'blur'

The state name corresponding to the blur state.

###${prefix} trigger(string | string[]) = 'pointerover'

Configuration of the triggering event for the interaction.

{{ use: element-active-trigger}}

###${prefix} triggerOff(string | string[]) = 'pointerout'

Configuration of the termination event for the interaction.

{{ use: element-active-trigger}}

##${prefix} type.element-select-by-graphic-name

Element selection interaction, sets the state of all elements with the same name to selected; note that this interaction is not recommended to be used with the default `select` interaction (except for pictorial charts).

###${prefix} state(string) = 'selected'

The state name corresponding to the selected state.

###${prefix} isMultiple(boolean) = true

Whether multiple selection is supported.

###${prefix} trigger(string | string[]) = 'click'

Configuration of the triggering event for the interaction.

{{ use: element-active-trigger}}

###${prefix} triggerOff(string | number | string[]) = 'pointerout'

Configuration of the termination event for the interaction; supported configurations include:

- 'empty': Clicking on an empty space
- number: Timed clearing of the selected state
- Other event names

{{ use: element-active-trigger}}
