import { TransitionStatusDataAttributes } from '../../internals/stateAttributesMapping';

export enum AccordionPanelDataAttributes {
  /**
   * Indicates the index of the accordion item.
   * @type {number}
   */
  index = 'data-index',
  /**
   * Present when the accordion panel is open.
   */
  open = 'data-open',
  /**
   * Indicates the orientation of the accordion.
   */
  orientation = 'data-orientation',
  /**
   * Present when the accordion item is disabled.
   */
  disabled = 'data-disabled',
  /**
   * Present when the panel is animating in.
   */
  startingStyle = TransitionStatusDataAttributes.startingStyle,
  /**
   * Present when the panel is animating out.
   */
  endingStyle = TransitionStatusDataAttributes.endingStyle,
}
