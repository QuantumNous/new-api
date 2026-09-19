import { morphPath, multiToOneMorph, oneToMultiMorph } from '@visactor/vrender-animate/custom/morphing';
import { isNil, isNumber, isValid, isValidNumber } from '@visactor/vutils';
import type { IMark, IMarkGraphic } from '../mark/interface';
import type { IMorphConfig } from '../animation/spec';
import type { Datum } from '../typings';

/** Morph data for animation */
interface MorphData {
  prev: Datum[];
  next: Datum[];
}

/** Elements to morph */
interface MorphElements {
  prev: IMarkGraphic[];
  next: IMarkGraphic[];
}

/** Type to allow either a static value or a function that returns a value */
type MorphFunctionValueType<T> = T | ((params: any, morphData: MorphData, morphElements: MorphElements) => T);

/**
 * Apply a function value or return the static value
 */
const invokeFunctionType = <T>(
  value: MorphFunctionValueType<T>,
  params: any,
  morphData: MorphData,
  morphElements: MorphElements
): T => {
  if (typeof value === 'function') {
    return (value as Function)(params, morphData, morphElements) as T;
  }
  return value;
};

/**
 * Execute the morphing animation between previous and next elements
 */
const doMorph = (
  prev: IMarkGraphic[],
  next: IMarkGraphic[],
  config: IMorphConfig,
  onEnd: () => void,
  parameters: any
) => {
  const morphData: MorphData = {
    prev: prev.map(element => element.context?.data?.[0]),
    next: next.map(element => element.context?.data?.[0])
  };

  const morphElements: MorphElements = {
    prev: prev.slice(),
    next: next.slice()
  };

  const animation = config.animation ?? {};
  const easing = animation.easing;
  const delay = invokeFunctionType(animation.delay as any, parameters, morphData, morphElements);
  const duration = invokeFunctionType(animation.duration as any, parameters, morphData, morphElements);
  const oneByOne = invokeFunctionType(animation.oneByOne as any, parameters, morphData, morphElements);
  const splitPath = invokeFunctionType(animation.splitPath as any, parameters, morphData, morphElements);

  const individualDelay =
    isValidNumber(oneByOne) && (oneByOne as number) > 0
      ? (index: number) => {
          if (isNumber(oneByOne)) {
            return index * (oneByOne as number);
          } else if (oneByOne === true) {
            return index * duration;
          }
          return 0;
        }
      : undefined;

  // if no previous item or just one, still execute morph animation
  if ((prev.length === 1 || prev.length === 0) && next.length === 1) {
    morphPath(prev[0], next[0], { delay, duration, easing, onEnd });
  } else if (prev.length === 1 && next.length > 1) {
    oneToMultiMorph(prev[0], next, { delay, duration, easing, onEnd, individualDelay, splitPath });
  } else if (prev.length > 1 && next.length === 1) {
    multiToOneMorph(prev, next[0], { delay, duration, easing, onEnd, individualDelay, splitPath });
  }
};

/**
 * Divide elements into specified number of groups
 */
const divideElements = (elements: IMarkGraphic[], count: number) => {
  const divideLength = Math.floor(elements.length / count);
  return new Array(count).fill(0).map((_, index) => {
    return elements.slice(divideLength * index, index === count - 1 ? elements.length : divideLength * (index + 1));
  });
};

/**
 * Add morphKey to each mark's graphics based on mark's morphConfig
 */
const appendMorphKeyToGraphics = (mark: IMark) => {
  const config = mark.getMarkConfig();

  if (isValid(config.morphElementKey)) {
    const graphics = mark.getGraphics();
    graphics.forEach(graphic => {
      const data = graphic.context?.data?.[0];
      if (data) {
        (graphic.context as any).morphKey = data[config.morphElementKey];
      }
    });
  }
};

/**
 * Execute morphing animation between two sets of marks
 */
export const morph = (prevMarks: IMark[], nextMarks: IMark[], morphConfig: IMorphConfig = {}) => {
  // Get all graphics from previous and next marks
  const prevGraphics: IMarkGraphic[] = [];
  const nextGraphics: IMarkGraphic[] = [];

  // Get graphics and append morph keys
  prevMarks.forEach(mark => {
    appendMorphKeyToGraphics(mark);
    prevGraphics.push(...mark.getGraphics());
  });

  nextMarks.forEach(mark => {
    appendMorphKeyToGraphics(mark);
    nextGraphics.push(...mark.getGraphics());
  });

  // Group graphics by morphKey if available
  const getKey = (graphic: IMarkGraphic) => (graphic.context as any)?.morphKey ?? graphic.context?.key;

  // Group graphics by their keys
  const prevByKey = new Map<string, IMarkGraphic[]>();
  const nextByKey = new Map<string, IMarkGraphic[]>();

  prevGraphics.forEach(graphic => {
    const key = getKey(graphic);
    if (key) {
      if (!prevByKey.has(key)) {
        prevByKey.set(key, []);
      }
      prevByKey.get(key).push(graphic);
    }
  });

  nextGraphics.forEach(graphic => {
    const key = getKey(graphic);
    if (key) {
      if (!nextByKey.has(key)) {
        nextByKey.set(key, []);
      }
      nextByKey.get(key).push(graphic);
    }
  });

  // TODO 这里逻辑有问题，无法实现一对多和多对一的morphing效果。所以如果无法执行一对一动画的话，直接不走morphing了
  if (!(prevByKey.size === nextByKey.size && Array.from(prevByKey.keys()).every(k => nextByKey.has(k)))) {
    return false;
  }

  // Find matching keys for update animation
  const updateKeys = [...new Set([...prevByKey.keys()].filter(key => nextByKey.has(key)))];

  // Find enter keys (in next but not in prev)
  const enterKeys = [...nextByKey.keys()].filter(key => !prevByKey.has(key));

  // Track morph operations to know when all are complete
  let morphCount = 0;
  const onMorphEnd = () => {
    morphCount -= 1;
    if (morphCount === 0) {
      // Enable animations for next marks after all morphs complete
      nextMarks.forEach(mark => {
        // If mark has any animation states that were disabled, re-enable them
        // This is placeholder logic - actual implementation depends on animation system
      });
    }
  };

  // Handle enter animations
  enterKeys.forEach(key => {
    const nextElements = nextByKey.get(key);
    doMorph([], nextElements, morphConfig, onMorphEnd, {});
    morphCount += 1;
  });

  // Handle update animations
  updateKeys.forEach(key => {
    const prevElements = prevByKey.get(key);
    const nextElements = nextByKey.get(key);

    // Handle different count scenarios
    const divideCount = Math.min(prevElements.length, nextElements.length);
    if (divideCount > 0) {
      const prevDivide = divideElements(prevElements, divideCount);
      const nextDivide = divideElements(nextElements, divideCount);

      for (let i = 0; i < divideCount; i++) {
        doMorph(prevDivide[i], nextDivide[i], morphConfig, onMorphEnd, {});
        morphCount += 1;
      }
    }
  });

  // Handle exit animations if needed (not in original sample but might be needed)
  // This would be similar to enter but with empty next elements

  // If no morphs were started, call onMorphEnd to ensure animations are re-enabled
  if (morphCount === 0) {
    onMorphEnd();
  }
  return true;
};
