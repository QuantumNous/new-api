import { TransitionStatusDataAttributes } from '../../internals/stateAttributesMapping';

export enum MenuCheckboxItemIndicatorDataAttributes {
  /**
   * Present when the menu checkbox item is checked.
   */
  checked = 'data-checked',
  /**
   * Present when the menu checkbox item is not checked.
   */
  unchecked = 'data-unchecked',
  /**
   * Present when the menu checkbox item is disabled.
   */
  disabled = 'data-disabled',
  /**
   * Present when the indicator is animating in.
   */
  startingStyle = TransitionStatusDataAttributes.startingStyle,
  /**
   * Present when the indicator is animating out.
   */
  endingStyle = TransitionStatusDataAttributes.endingStyle,
}
