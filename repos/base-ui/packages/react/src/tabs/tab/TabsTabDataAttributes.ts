export enum TabsTabDataAttributes {
  /**
   * Indicates the direction of the activation (based on the previous active tab).
   * @type {'left' | 'right' | 'up' | 'down' | 'none'}
   */
  activationDirection = 'data-activation-direction',
  /**
   * Indicates the orientation of the tabs.
   * @type {'horizontal' | 'vertical'}
   */
  orientation = 'data-orientation',
  /**
   * Present when the tab is disabled.
   */
  disabled = 'data-disabled',
  /**
   * Present when the tab is active.
   */
  active = 'data-active',
}
