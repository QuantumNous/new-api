/**
 * Flags used to manage and optimize the rendering lifecycle of content of the cell,
 * while using FlexRenderDirective.
 */
export enum FlexRenderFlags {
  /**
   * Indicates that the view is being created for the first time or will be cleared during the next update phase.
   * This is the initial state and will transition after the first ngDoCheck.
   */
  ViewFirstRender = 1 << 0,
  /**
   * Represents a state where the view is not dirty, meaning no changes require rendering updates.
   */
  Pristine = 1 << 1,
  /**
   * Indicates the `content` property has been modified or the view requires a complete re-render.
   * When this flag is enabled, the view will be cleared and recreated from scratch.
   */
  ContentChanged = 1 << 2,
  /**
   * Indicates that the `props` property reference has changed.
   * When this flag is enabled, the view context is updated based on the type of the content.
   *
   * For Component view, inputs will be updated and view will be marked as dirty.
   * For TemplateRef and primitive values, view will be marked as dirty
   */
  PropsReferenceChanged = 1 << 3,
  /**
   * Indicates that the current rendered view needs to be checked for changes.
   */
  DirtyCheck = 1 << 4,
  /**
   * Indicates that a signal within the `content(props)` result has changed
   */
  DirtySignal = 1 << 5,
  /**
   * Indicates that the first render effect has been checked at least one time.
   */
  RenderEffectChecked = 1 << 6,
}
