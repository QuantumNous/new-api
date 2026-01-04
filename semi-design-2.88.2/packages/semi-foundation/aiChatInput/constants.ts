import { PLACEHOLDERS } from '@babel/types';
import { BASE_CLASS_PREFIX } from '../base/constants';

const cssClasses = {
    PREFIX: `${BASE_CLASS_PREFIX}-aiChatInput`,
};

const strings = {
    TOPS_SLOT_POSITION_DEFAULT: "top",
    ZERO_WIDTH_CHAR: '\uFEFF',
    PIC_PREFIX: 'image/',
    PIC_SUFFIX_ARRAY: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp']
};

const numbers = {
    SCROLL_AMOUNT: 300,
    SKILL_MAX_HEIGHT: 270,
    TEMPLATE_MAX_HEIGHT: 500,
    SUGGESTION_MAX_HEIGHT: 270,
};

export { cssClasses, strings, numbers };