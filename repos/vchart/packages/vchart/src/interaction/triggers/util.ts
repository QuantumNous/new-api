import { array, isNumber, isString } from '@visactor/vutils';
import type { IMark, IMarkGraphic } from '../../mark/interface/common';

import type { IElementFilterOptions, IElementHighlightOptions, IElementSelectTriggerOff } from '../interface/trigger';
import type { GraphicEventType } from '@visactor/vrender-core';
import type { IBaseInteractionSpec } from '../interface/spec';
import { getDatumOfGraphic } from '../../util';
import type { Datum } from '../../typings';
import { STATE_VALUE_ENUM } from '../../compile/mark/interface';

export const parseTriggerOffOfSelect = (triggerOff: IElementSelectTriggerOff | IElementSelectTriggerOff[]) => {
  const triggerOffArray = array(triggerOff);
  const resetType: ('view' | 'self' | 'timeout')[] = [];
  const eventNames: GraphicEventType[] = [];

  triggerOffArray.forEach(off => {
    if (off === 'empty') {
      resetType.push('view');
    } else if (isString(off) && off !== 'none') {
      if ((off as string).includes('view:')) {
        eventNames.push((off as string).replace('view:', '') as GraphicEventType);

        resetType.push('view');
      } else {
        eventNames.push(off as GraphicEventType);

        resetType.push('self');
      }
    } else if (isNumber(off)) {
      resetType.push('timeout');
    }
  });

  return {
    eventNames,
    resetType
  };
};

export const groupMarksByState = (marks: IMark[], states: string[]): Record<string, number[]> => {
  if (!states || !marks) {
    return null;
  }

  const res: Record<string, number[]> = {};

  marks.forEach(mark => {
    const stateStyle = mark.stateStyle;

    if (!stateStyle) {
      return;
    }

    states.forEach(state => {
      if (state && stateStyle[state]) {
        if (!res[state]) {
          res[state] = [];
        }

        res[state].push(mark.id);
      }
    });
  });

  return res;
};

export const filterMarksOfInteraction = (interactionSpec: IBaseInteractionSpec, marks: IMark[]) => {
  if (!marks || !marks.length) {
    return [];
  }
  const selector: IMark[] = [];

  if (interactionSpec.markIds) {
    marks.filter(mark => {
      if (interactionSpec.markIds.includes(mark.getProductId())) {
        selector.push(mark);
      }
    });
  } else if (interactionSpec.markNames) {
    marks.forEach(mark => {
      if (interactionSpec.markNames.includes(mark.name)) {
        selector.push(mark);
      }
    });
  } else {
    marks.forEach(mark => {
      selector.push(mark);
    });
  }

  return selector;
};

export const generateFilterValue = (options: IElementFilterOptions) => {
  if (options.filterField) {
    return (g: IMarkGraphic) => {
      return (getDatumOfGraphic(g) as Datum)?.[options.filterField];
    };
  }

  return (el: IMarkGraphic) => {
    return el.context[options.filterType];
  };
};

export const highlightDefaultOptions: Partial<IElementHighlightOptions> = {
  highlightState: STATE_VALUE_ENUM.STATE_HIGHLIGHT,
  blurState: STATE_VALUE_ENUM.STATE_BLUR,
  trigger: 'pointerover',
  triggerOff: 'pointerout'
};
