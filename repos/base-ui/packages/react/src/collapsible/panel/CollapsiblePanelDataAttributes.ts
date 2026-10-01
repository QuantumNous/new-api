import { TransitionStatusDataAttributes } from '../../internals/stateAttributesMapping';

export enum CollapsiblePanelDataAttributes {
  /**
   * Present when the collapsible panel is open.
   */
  open = 'data-open',
  /**
   * Present when the collapsible panel is closed.
   */
  closed = 'data-closed',
  /**
   * Present when the panel is animating in.
   */
  startingStyle = TransitionStatusDataAttributes.startingStyle,
  /**
   * Present when the panel is animating out.
   */
  endingStyle = TransitionStatusDataAttributes.endingStyle,
}
