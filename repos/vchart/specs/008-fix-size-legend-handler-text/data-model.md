# Data Model: Size Legend Handler Text Layout

## Entities

### Continuous Legend Handler Text Config

- Purpose: Represents the public `handlerText` configuration supplied in a continuous legend spec.
- Fields:
  - `visible`: optional boolean toggle
  - `precision`: optional numeric precision for displayed value
  - `formatter`: optional text formatter
  - `space`: optional spacing between handler and text
  - `style`: either a static text style object or a callback returning a text style object
- Relationships:
  - Belongs to `IContinuousLegendSpec`
  - Is transformed into vrender continuous legend attributes by `getContinuousLegendAttributes`

### Continuous Legend Render Attributes

- Purpose: Runtime attributes passed from VChart to `@visactor/vrender-components`.
- Fields:
  - `handlerText`: transformed handler text config
  - `startText` / `endText`: sibling text configs using the same transformation helper
  - `handlerStyle`, `railStyle`, `trackStyle`: other transformed style attributes
- Relationships:
  - Derived from the legend spec
  - Consumed by `SizeContinuousLegend` and `ColorContinuousLegend`

## State Transitions

1. User provides a continuous legend spec with `handlerText.style`.
2. VChart merges theme defaults and user spec.
3. `getContinuousLegendAttributes` transforms `handlerText` through `transformComponentStyle`.
4. The resulting static object or callback is passed to the continuous legend component.
5. During render or interaction updates, the component evaluates the style and applies it to the handler text.
