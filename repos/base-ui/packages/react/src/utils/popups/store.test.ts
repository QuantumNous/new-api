import { describe, expect, it } from 'vitest';
import { createInitialPopupStoreState, popupStoreSelectors, type PopupStoreState } from './store';

function createState(state: Partial<PopupStoreState<unknown>>) {
  return {
    ...createInitialPopupStoreState(),
    activeTriggerId: 'trigger',
    ...state,
  };
}

describe('popupStoreSelectors', () => {
  describe('isOpenedByTrigger', () => {
    it('uses the controlled open state when present', () => {
      expect(
        popupStoreSelectors.isOpenedByTrigger(
          createState({
            open: false,
            openProp: true,
          }),
          'trigger',
        ),
      ).toBe(true);

      expect(
        popupStoreSelectors.isOpenedByTrigger(
          createState({
            open: true,
            openProp: false,
          }),
          'trigger',
        ),
      ).toBe(false);
    });

    it('uses the internal open state when uncontrolled', () => {
      expect(
        popupStoreSelectors.isOpenedByTrigger(
          createState({
            open: true,
          }),
          'trigger',
        ),
      ).toBe(true);

      expect(
        popupStoreSelectors.isOpenedByTrigger(
          createState({
            open: false,
          }),
          'trigger',
        ),
      ).toBe(false);
    });

    it('requires the trigger to be active', () => {
      expect(
        popupStoreSelectors.isOpenedByTrigger(
          createState({
            open: false,
            openProp: true,
          }),
          'other-trigger',
        ),
      ).toBe(false);
    });
  });
});
