export enum HOOK_EVENT {
  BEFORE_EVALUATE_DATA = 'beforeEvaluateData',
  AFTER_EVALUATE_DATA = 'afterEvaluateData',

  BEFORE_EVALUATE_SCALE = 'beforeEvaluateScale',
  AFTER_EVALUATE_SCALE = 'afterEvaluateScale',

  BEFORE_PARSE_VIEW = 'beforeParseView',
  AFTER_PARSE_VIEW = 'afterParseView',

  BEFORE_TRANSFORM = 'beforeTransform',
  AFTER_TRANSFORM = 'afterTransform',

  BEFORE_CREATE_VRENDER_STAGE = 'beforeCreateVRenderStage',
  AFTER_CREATE_VRENDER_STAGE = 'afterCreateVRenderStage',

  BEFORE_CREATE_VRENDER_LAYER = 'beforeCreateVRenderLayer',
  AFTER_CREATE_VRENDER_LAYER = 'afterCreateVRenderLayer',

  BEFORE_STAGE_RESIZE = 'beforeStageResize',
  AFTER_STAGE_RESIZE = 'afterStageResize',

  BEFORE_VRENDER_DRAW = 'beforeVRenderDraw',
  AFTER_VRENDER_DRAW = 'afterVRenderDraw',

  BEFORE_MARK_JOIN = 'beforeMarkJoin',
  AFTER_MARK_JOIN = 'afterMarkJoin',
  BEFORE_MARK_UPDATE = 'beforeMarkUpdate',
  AFTER_MARK_UPDATE = 'afterMarkUpdate',
  BEFORE_MARK_STATE = 'beforeMarkState',
  AFTER_MARK_STATE = 'afterMarkState',
  BEFORE_MARK_ENCODE = 'beforeMarkEncode',
  AFTER_MARK_ENCODE = 'afterMarkEncode',

  BEFORE_DO_LAYOUT = 'beforeDoLayout',
  AFTER_DO_LAYOUT = 'afterDoLayout',

  BEFORE_MARK_LAYOUT_END = 'beforeMarkLayoutEnd',
  AFTER_MARK_LAYOUT_END = 'afterMarkLayoutEnd',

  BEFORE_DO_RENDER = 'beforeDoRender',
  AFTER_DO_RENDER = 'afterDoRender',

  BEFORE_MARK_RENDER_END = 'beforeMarkRenderEnd',
  AFTER_MARK_RENDER_END = 'afterMarkRenderEnd',

  BEFORE_CREATE_VRENDER_MARK = 'beforeCreateVRenderMark',
  AFTER_CREATE_VRENDER_MARK = 'afterCreateVRenderMark',

  BEFORE_ADD_VRENDER_MARK = 'beforeAddVRenderMark',
  AFTER_ADD_VRENDER_MARK = 'afterAddVRenderMark',

  AFTER_VRENDER_NEXT_RENDER = 'afterVRenderNextRender',

  BEFORE_ELEMENT_UPDATE_DATA = 'beforeElementUpdateData',
  AFTER_ELEMENT_UPDATE_DATA = 'afterElementUpdateData',

  BEFORE_ELEMENT_STATE = 'beforeElementState',
  AFTER_ELEMENT_STATE = 'afterElementState',

  BEFORE_ELEMENT_ENCODE = 'beforeElementEncode',
  AFTER_ELEMENT_ENCODE = 'afterElementEncode',

  ANIMATION_START = 'animationStart',
  ANIMATION_END = 'animationEnd',

  ELEMENT_ANIMATION_START = 'elementAnimationStart',
  ELEMENT_ANIMATION_END = 'elementAnimationEnd',

  ALL_ANIMATION_START = 'allAnimationStart',
  ALL_ANIMATION_END = 'allAnimationEnd'
}

export const BASE_EVENTS = [
  'pointerdown',
  'pointerup',
  'pointerupoutside',
  'pointertap', // pointerEvent 下的 click 事件
  'pointerover',
  'pointermove',
  'pointerenter',
  'pointerleave',
  'pointerout',
  'mousedown',
  'mouseup',
  'mouseupoutside',
  'rightdown',
  'rightup',
  'rightupoutside',
  'click',
  'dblclick',
  'mousemove',
  'mouseover',
  'mouseout',
  'mouseenter',
  'mouseleave',
  'wheel',
  'touchstart',
  'touchend',
  'touchendoutside',
  'touchmove',
  'touchcancel',
  'tap',
  'dragstart',
  'drag',
  'dragenter',
  'dragleave',
  'dragover',
  'dragend',
  'drop',
  // 手势事件
  'pan',
  'panstart',
  'panend',
  'press',
  'pressup',
  'pressend',
  'pinch',
  'pinchstart',
  'pinchend',
  'swipe'
];

export enum ChartEvent {
  initialized = 'initialized', // 图表实例初始化完成
  rendered = 'rendered', // 图表渲染方法被调用时触发，表明图表已经执行过渲染逻辑，只会触发一次
  renderFinished = 'renderFinished', // 每次画布渲染完成触发的事件，不包含动画结束
  animationFinished = 'animationFinished', // 图表动画结束时触发的事件
  // region
  regionSeriesDataFilterOver = 'regionSeriesDataFilterOver',
  // series start
  // series.liftCircle
  afterInitData = 'afterInitData',
  afterInitEvent = 'afterInitEvent',
  afterInitMark = 'afterInitMark',
  // series.data
  rawDataUpdate = 'rawDataUpdate',
  viewDataFilterOver = 'viewDataFilterOver',
  viewDataUpdate = 'viewDataUpdate',
  viewDataStatisticsUpdate = 'viewDataStatisticsUpdate',
  // dot series
  markDeltaYUpdate = 'markDeltaYUpdate',
  // pie series
  viewDataLabelUpdate = 'viewDataLabelUpdate',
  /** series end */
  // scale
  scaleDomainUpdate = 'scaleDomainUpdate',
  scaleRawDomainUpdate = 'scaleRawDomainUpdate',
  scaleUpdate = 'scaleUpdate',
  // datazoom
  dataZoomChange = 'dataZoomChange',
  // Hierarchy
  drill = 'drill',
  layoutStart = 'layoutStart',
  layoutEnd = 'layoutEnd',
  layoutRectUpdate = 'layoutRectUpdate',

  // player
  playerPlay = 'playerPlay',
  playerPause = 'playerPause',
  playerEnd = 'playerEnd',
  playerChange = 'playerChange',
  playerForward = 'playerForward',
  playerBackward = 'playerBackward',
  // scrollBar
  scrollBarChange = 'scrollBarChange',
  // brush
  brushStart = 'brushStart',
  brushChange = 'brushChange',
  brushEnd = 'brushEnd',
  brushClear = 'brushClear',
  brushActive = 'brushActive',
  // legend
  legendSelectedDataChange = 'legendSelectedDataChange',
  legendFilter = 'legendFilter',
  legendItemClick = 'legendItemClick',
  legendItemHover = 'legendItemHover',
  legendItemUnHover = 'legendItemUnHover',
  // tooltip
  tooltipShow = 'tooltipShow',
  tooltipHide = 'tooltipHide',
  tooltipRelease = 'tooltipRelease',
  // resize
  afterResize = 'afterResize',
  afterRender = 'afterRender',
  // layout
  afterLayout = 'afterLayout',
  afterMarkLayoutEnd = 'afterMarkLayoutEnd',
  // wordcloud
  afterWordcloudShapeDraw = 'afterWordcloudShapeDraw'
}

export enum Event_Source_Type {
  chart = 'chart',
  window = 'window',
  canvas = 'canvas'
}

export enum Event_Bubble_Level {
  vchart = 'vchart',
  chart = 'chart',
  model = 'model',
  mark = 'mark'
}

// 事件冒泡逻辑：Mark -> Model -> Chart -> VChart
export const EventBubbleLevels = [
  Event_Bubble_Level.mark,
  Event_Bubble_Level.model,
  Event_Bubble_Level.chart,
  Event_Bubble_Level.vchart
];
