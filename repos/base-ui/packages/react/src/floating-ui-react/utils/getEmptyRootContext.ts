import { PopupTriggerMap } from '../../utils/popups';
import { FloatingRootStore } from '../components/FloatingRootStore';
import type { FloatingRootContext } from '../types';

export function getEmptyRootContext(): FloatingRootContext {
  return new FloatingRootStore({
    open: false,
    transitionStatus: undefined,
    floatingElement: null,
    referenceElement: null,
    triggerElements: new PopupTriggerMap(),
    floatingId: undefined,
    syncOnly: false,
    nested: false,
    onOpenChange: undefined,
  });
}
