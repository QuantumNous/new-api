import { TransitionStatusDataAttributes } from '../../internals/stateAttributesMapping';

export enum MenuRadioItemIndicatorDataAttributes {
  /**
   * Present when the menu radio item is selected.
   */
  checked = 'data-checked',
  /**
   * Present when the menu radio item is not selected.
   */
  unchecked = 'data-unchecked',
  /**
   * Present when the menu radio item is disabled.
   */
  disabled = 'data-disabled',
  /**
   * Present when the radio indicator is animating in.
   */
  startingStyle = TransitionStatusDataAttributes.startingStyle,
  /**
   * Present when the radio indicator is animating out.
   */
  endingStyle = TransitionStatusDataAttributes.endingStyle,
}
