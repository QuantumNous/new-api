import { EMPTY_OBJECT } from '@base-ui/utils/empty';
import { DISABLED_TRANSITIONS_STYLE } from '../internals/constants';
import type { TransitionStatus } from '../internals/useTransitionStatus';

export function getDisabledMountTransitionStyles(transitionStatus: TransitionStatus): {
  style?: React.CSSProperties | undefined;
} {
  return transitionStatus === 'starting' ? DISABLED_TRANSITIONS_STYLE : EMPTY_OBJECT;
}
