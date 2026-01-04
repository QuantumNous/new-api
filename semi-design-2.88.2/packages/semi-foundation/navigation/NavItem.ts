import { numbers } from './constants';

export const DEFAULT_TOGGLE_ICON = {
    open: 'chevron_up',
    closed: 'chevron_down',
};

export default class NavItem {
    items: any[];
    toggleIcon: any;
    constructor(options: any = {}) {
        if (options == null || typeof options !== 'object') {
            options = {
                text: options,
                itemKey: options,
                maxHeight: numbers.DEFAULT_SUBNAV_MAX_HEIGHT,
                // selected: false,
                // isOpen: false,
                link: null,
                items: null,
                icon: '',
                indent: false,
            };
        }

        for (const key of Object.keys(options)) {
            this[key] = options[key];
        }

        if (options.items && Array.isArray(options.items) && options.items.length) {
            this.items = options.items.map((item: any) => new NavItem(item));

            if ('toggleIcon' in options) {
                this.toggleIcon = NavItem.isValidToggleIcon(options.toggleIcon)
                    ? { ...options.toggleIcon }
                    : { ...DEFAULT_TOGGLE_ICON };
            } else {
                this.toggleIcon = { ...DEFAULT_TOGGLE_ICON };
            }
        } else {
            this.items = null;
        }
    }

    static isValidToggleIcon(toggleIcon: any) {
        return Boolean(toggleIcon &&
            typeof toggleIcon === 'object' &&
            typeof toggleIcon.open === 'string' &&
            toggleIcon.open.length &&
            typeof toggleIcon.closed === 'string' &&
            toggleIcon.closed.length);
    }
}
