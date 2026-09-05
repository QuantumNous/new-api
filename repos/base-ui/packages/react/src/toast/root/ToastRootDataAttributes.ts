import { TransitionStatusDataAttributes } from '../../internals/stateAttributesMapping';

export enum ToastRootDataAttributes {
  /**
   * Present when the toast is expanded in the viewport.
   * @type {boolean}
   */
  expanded = 'data-expanded',
  /**
   * Present when the toast was limited because the toast limit was exceeded.
   * @type {boolean}
   */
  limited = 'data-limited',
  /**
   * The type of the toast.
   * @type {string}
   */
  type = 'data-type',
  /**
   * Present when the toast is being swiped.
   * @type {boolean}
   */
  swiping = 'data-swiping',
  /**
   * The direction the toast was swiped.
   * @type {'up' | 'down' | 'left' | 'right'}
   */
  swipeDirection = 'data-swipe-direction',
  /**
   * Present when the toast is animating in.
   */
  startingStyle = TransitionStatusDataAttributes.startingStyle,
  /**
   * Present when the toast is animating out.
   */
  endingStyle = TransitionStatusDataAttributes.endingStyle,
}
