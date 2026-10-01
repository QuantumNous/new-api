{{ target: element-active-trigger }}

<!-- ElementActiveSpec -->

事件类型包括:

`'pointerdown'
  | 'pointerup'
  | 'pointermove'
  // 指针抬起与按下的图形不同时触发
  | 'pointerupoutside'
  | 'pointertap'
  | 'pointerover'
  | 'pointermove'
  | 'pointerenter'
  | 'pointerleave'
  | 'pointerout'
  | 'mousedown'
  | 'mouseup'
  | 'mouseupoutside'
  // 右键操作
  | 'rightdown'
  | 'rightup'
  | 'rightupoutside'
  | 'click'
`
等

所有事件列表见: https://github.com/VisActor/VGrammar/blob/develop/packages/vgrammar-core/src/types/event.ts中的 `EventType`
