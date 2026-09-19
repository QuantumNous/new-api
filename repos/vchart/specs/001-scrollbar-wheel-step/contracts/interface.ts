export interface IScrollBarSpec {
  /**
   * Scroll step in pixels for wheel events.
   * If set, wheel events will scroll by this fixed distance per notch.
   */
  scrollStep?: number;

  /**
   * Minimum slider size in pixels.
   * The slider will be rendered with at least this size.
   */
  minSliderSize?: number;
}
