import { TransitionStatusDataAttributes } from '../../internals/stateAttributesMapping';

export enum AvatarImageDataAttributes {
  /**
   * Present when the image is animating in.
   */
  startingStyle = TransitionStatusDataAttributes.startingStyle,
  /**
   * Present when the image is animating out.
   */
  endingStyle = TransitionStatusDataAttributes.endingStyle,
}
