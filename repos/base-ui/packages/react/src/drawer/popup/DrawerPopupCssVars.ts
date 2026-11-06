export enum DrawerPopupCssVars {
  /**
   * The number of nested drawers that are currently open.
   * @type {number}
   */
  nestedDrawers = '--nested-drawers',
  /**
   * The height of the drawer popup.
   * @type {CSS length}
   */
  height = '--drawer-height',
  /**
   * The height of the frontmost open drawer in the current nested drawer stack.
   * @type {CSS length}
   */
  frontmostHeight = '--drawer-frontmost-height',
  /**
   * The swipe movement on the X axis.
   * @type {CSS length}
   */
  swipeMovementX = '--drawer-swipe-movement-x',
  /**
   * The swipe movement on the Y axis.
   * @type {CSS length}
   */
  swipeMovementY = '--drawer-swipe-movement-y',
  /**
   * The snap point offset used for translating the drawer.
   * @type {CSS length}
   */
  snapPointOffset = '--drawer-snap-point-offset',
  /**
   * A scalar (0.1-1) used to scale the swipe release transition duration in CSS.
   * @type {number}
   */
  swipeStrength = '--drawer-swipe-strength',
}
