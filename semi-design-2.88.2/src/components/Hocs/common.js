import { each, set } from 'lodash-es';

export function getPopupContainer() {
    return document.querySelector('.scroll-wrapper');
}

export function forwardStatics(obj, origin) {
    each(origin, (val, key) => {
        set(obj, key, val);
    });

    return obj;
}
