{{ target: trigger-spec }}

<!-- ITriggerSpec -->

事件类型包括:

1. 基础事件： `'pointerdown'| 'pointerup' | 'pointerupoutside' | 'pointertap'`等  
   所有事件列表见: https://github.com/VisActor/VChart/blob/develop/packages/vchart/src/constant/event.ts 中的`BASE_EVENTS`
2. 图表事件:

   - `initialized` 图表实例初始化完成
   - `rendered` 图表渲染方法被调用时触发，表明图表已经执行过渲染逻辑，只会触发一次
   - `renderFinished` 每次画布渲染完成触发的事件，不包含动画结束
     等  
     所有事件列表见: https://github.com/VisActor/VChart/blob/develop/packages/vchart/src/constant/event.ts 中的`ChartEvent`

3. VGrammar实例透出的事件:

   - `beforeEvaluateData` 数据处理前触发
   - `afterEvaluateData`数据处理后触发
   - `beforeEvaluateScale`scale处理前触发
   - `afterEvaluateScale`scale处理后触发
     等  
     所有事件列表见: https://github.com/VisActor/VGrammar/blob/develop/packages/vgrammar-core/src/graph/enums.ts中的 `HOOK_EVENT`
