import type { StateAttributesMapping } from '../internals/getStateAttributesProps';
import { TransitionStatusDataAttributes } from '../internals/stateAttributesMapping';

export enum CommonPopupDataAttributes {
  /**
   * Present when the popup is open.
   */
  open = 'data-open',
  /**
   * Present when the popup is closed.
   */
  closed = 'data-closed',
  /**
   * Present when the popup is animating in.
   */
  startingStyle = TransitionStatusDataAttributes.startingStyle,
  /**
   * Present when the popup is animating out.
   */
  endingStyle = TransitionStatusDataAttributes.endingStyle,
  /**
   * Present when the anchor is hidden.
   */
  anchorHidden = 'data-anchor-hidden',
  /**
   * Indicates which side the popup is positioned relative to the trigger.
   * @type { 'top' | 'bottom' | 'left' | 'right' | 'inline-end' | 'inline-start'}
   */
  side = 'data-side',
  /**
   * Indicates how the popup is aligned relative to specified side.
   * @type {'start' | 'center' | 'end'}
   */
  align = 'data-align',
}

export enum CommonTriggerDataAttributes {
  /**
   * Present when the popup is open.
   */
  popupOpen = 'data-popup-open',
  /**
   * Present when a pressable trigger is pressed.
   */
  pressed = 'data-pressed',
}

const TRIGGER_HOOK = {
  [CommonTriggerDataAttributes.popupOpen]: '',
};

const PRESSABLE_TRIGGER_HOOK = {
  [CommonTriggerDataAttributes.popupOpen]: '',
  [CommonTriggerDataAttributes.pressed]: '',
};

const POPUP_OPEN_HOOK = {
  [CommonPopupDataAttributes.open]: '',
};

const POPUP_CLOSED_HOOK = {
  [CommonPopupDataAttributes.closed]: '',
};

const ANCHOR_HIDDEN_HOOK = {
  [CommonPopupDataAttributes.anchorHidden]: '',
};

export const triggerOpenStateMapping = {
  open(value) {
    if (value) {
      return TRIGGER_HOOK;
    }
    return null;
  },
} satisfies StateAttributesMapping<{ open: boolean }>;

export const pressableTriggerOpenStateMapping = {
  open(value) {
    if (value) {
      return PRESSABLE_TRIGGER_HOOK;
    }
    return null;
  },
} satisfies StateAttributesMapping<{ open: boolean }>;

export const popupStateMapping = {
  open(value) {
    if (value) {
      return POPUP_OPEN_HOOK;
    }
    return POPUP_CLOSED_HOOK;
  },
  anchorHidden(value) {
    if (value) {
      return ANCHOR_HIDDEN_HOOK;
    }
    return null;
  },
} satisfies StateAttributesMapping<{ open: boolean; anchorHidden: boolean }>;
