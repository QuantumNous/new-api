import { array, maxInArray } from '@visactor/vutils';
import type { SinglePageConfigList, PageTransitionConfigList, TransitionType } from '../interface';

export const getPageTransitionConfig = <T extends object>(
  list: PageTransitionConfigList<T> | undefined,
  type: TransitionType,
  fromPageId: number,
  toPageId: number,
): T[] => {
  return (
    list?.filter(({ fromPage, toPage, transitionType }) => {
      if (transitionType !== type) {
        return false;
      }
      const from = !fromPage || array(fromPage).includes(fromPageId);
      const to = !toPage || array(toPage).includes(toPageId);
      return from && to;
    }) ?? []
  );
};

export const getSinglePageConfig = <T extends object>(
  list: SinglePageConfigList<T> | undefined,
  pageId: number,
): T[] => {
  return list?.filter(({ page }) => !page || array(page).includes(pageId)) ?? [];
};

export const computeDuration = <T extends { duration?: number }>(list: T[]): number => {
  return list.length ? maxInArray(list.map(({ duration }) => duration ?? 0)) : 0;
};
