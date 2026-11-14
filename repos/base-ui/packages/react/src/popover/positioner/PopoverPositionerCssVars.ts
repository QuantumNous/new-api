export enum PopoverPositionerCssVars {
  /**
   * The available width between the trigger and the edge of the viewport.
   * @type {number}
   */
  availableWidth = '--available-width',
  /**
   * The available height between the trigger and the edge of the viewport.
   * @type {number}
   */
  availableHeight = '--available-height',
  /**
   * The anchor's width.
   * @type {number}
   */
  anchorWidth = '--anchor-width',
  /**
   * The anchor's height.
   * @type {number}
   */
  anchorHeight = '--anchor-height',
  /**
   * The coordinates that this element is anchored to. Used for animations and transitions.
   * @type {string}
   */
  transformOrigin = '--transform-origin',
  /**
   * The width of the popover's positioner.
   * It is important to set `width` to this value when using CSS to animate size changes.
   */
  positionerWidth = '--positioner-width',
  /**
   * The height of the popover's positioner.
   * It is important to set `height` to this value when using CSS to animate size changes.
   */
  positionerHeight = '--positioner-height',
}
