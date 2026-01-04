import classnames, { Argument } from 'classnames';
import { split, filter, map } from 'lodash';

function addClass(rawCls: Argument, ...srcClss: Argument[]) {
    const clss = split(rawCls as string, /\s+/);
    const validClss = filter(srcClss, cls => !clss.includes(cls as string));

    return classnames(rawCls, ...validClss);
}

function removeClass(rawCls: Argument, ...srcClss: Argument[]) {
    const clss = split(rawCls as string, /\s+/);

    map(srcClss, cls => {
        const index = clss.indexOf(cls as string);

        if (index > -1) {
            clss.splice(index, 1);
        }
    });

    return classnames(...clss);
}

export { addClass, removeClass };
