{{ target: trigger-spec }}

<!-- ITriggerSpec -->

Event types include:

1. Basic events: `'pointerdown'| 'pointerup' | 'pointerupoutside' | 'pointertap'`, etc.

For a list of all events, see: `BASE_EVENTS` in https://github.com/VisActor/VChart/blob/develop/packages/vchart/src/constant/event.ts

2. Chart events:

- `initialized` Chart instance initialization completed

- `rendered` Triggered when the chart rendering method is called, indicating that the chart has executed the rendering logic, and will only be triggered once

- `renderFinished` Event triggered each time the canvas rendering is completed, excluding the end of the animation

, etc.

For a list of all events, see: `ChartEvent` in https://github.com/VisActor/VChart/blob/develop/packages/vchart/src/constant/event.ts

3. Events exposed by the VGrammar instance:

- `beforeEvaluateData` triggers before data processing
- `afterEvaluateData` triggers after data processing
- `beforeEvaluateScale` triggers before scale processing
- `afterEvaluateScale` triggers after scale processing
  etc.
  For a list of all events, see: `HOOK_EVENT` in https://github.com/VisActor/VGrammar/blob/develop/packages/vgrammar-core/src/graph/enums.ts
