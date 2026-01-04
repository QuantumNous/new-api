import { cssClasses as inputCssClasses, numbers as inputNumbers, strings as inputStrings } from '../input/constants';

const cssClasses = {
    ...inputCssClasses,
};

const numbers = {
    ...inputNumbers,
    DEFAULT_STEP: 1,
    DEFAULT_SHIFT_STEP: 10,
    DEFAULT_PRESS_TIMEOUT: 250,
    DEFAULT_PRESS_INTERVAL: 0,
    MOUSE_BUTTON_LEFT: 0, // left mouse button
};

const strings = {
    ...inputStrings,
};

export { cssClasses, numbers, strings };
