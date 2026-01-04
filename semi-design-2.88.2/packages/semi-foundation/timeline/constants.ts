import { BASE_CLASS_PREFIX } from '../base/constants';

const cssClasses = {
    PREFIX: `${BASE_CLASS_PREFIX}-timeline`,
    ITEM: `${BASE_CLASS_PREFIX}-timeline-item`
};

const strings = {
    MODE: ['left', 'alternate', 'right', 'center'],
    ITEM_POS: ['left', 'right'],
    ITEM_TYPE: ['ongoing', 'success', 'warning', 'error', 'default']
};

export { cssClasses, strings };