import { BASE_CLASS_PREFIX } from '../base/constants';

const cssClasses = {
    CAROUSEL: `${BASE_CLASS_PREFIX}-carousel`,
    CAROUSEL_INDICATOR: `${BASE_CLASS_PREFIX}-carousel-indicator`,
    CAROUSEL_INDICATOR_LINE: `${BASE_CLASS_PREFIX}-carousel-indicator-line`,
    CAROUSEL_INDICATOR_DOT: `${BASE_CLASS_PREFIX}-carousel-indicator-dot`,
    CAROUSEL_INDICATOR_COLUMNAR: `${BASE_CLASS_PREFIX}-carousel-indicator-columnar`,
    CAROUSEL_INDICATOR_INACTIVE: `${BASE_CLASS_PREFIX}-carousel-indicator-inactive`,
    CAROUSEL_INDICATOR_ACTIVE: `${BASE_CLASS_PREFIX}-carousel-indicator-active`,
    CAROUSEL_CONTENT: `${BASE_CLASS_PREFIX}-carousel-content`,
    CAROUSEL_ARROW: `${BASE_CLASS_PREFIX}-carousel-arrow`,
};

const numbers = {
    DEFAULT_ACTIVE_INDEX: 0,
    DEFAULT_INTERVAL: 2000,
    DEFAULT_SPEED: 300,
};

const strings = {
    ANIMATION_MAP: ['slide', 'fade'],
    DIRECTION: ['left', 'right'],
    TYPE_MAP: ['columnar', 'line', 'dot'],
    THEME_MAP: ['dark', 'primary', 'light'],
    POSITION_MAP: ['left', 'center', 'right'],
    ARROW_MAP: ['always', 'hover'],
    SIZE: ['small', 'medium'],
    TRIGGER: ['click', 'hover'],
} as const;

export { cssClasses, numbers, strings };