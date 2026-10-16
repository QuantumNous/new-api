export enum ScrollAreaRootDataAttributes {
  /**
   * Present when the user scrolls inside the scroll area.
   */
  scrolling = 'data-scrolling',
  /**
   * Present when the scroll area content is wider than the viewport.
   */
  hasOverflowX = 'data-has-overflow-x',
  /**
   * Present when the scroll area content is taller than the viewport.
   */
  hasOverflowY = 'data-has-overflow-y',
  /**
   * Present when there is overflow on the horizontal start side.
   */
  overflowXStart = 'data-overflow-x-start',
  /**
   * Present when there is overflow on the horizontal end side.
   */
  overflowXEnd = 'data-overflow-x-end',
  /**
   * Present when there is overflow on the vertical start side.
   */
  overflowYStart = 'data-overflow-y-start',
  /**
   * Present when there is overflow on the vertical end side.
   */
  overflowYEnd = 'data-overflow-y-end',
}
