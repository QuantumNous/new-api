import { merge, clone as lodashClone, find, map } from 'lodash';
import Logger from '@douyinfe/semi-foundation/utils/Logger';
import { numbers, strings } from '@douyinfe/semi-foundation/table/constants';
import { cloneDeep } from '../_utils';
import { TableComponents, Virtualized } from './interface';
import { getColumnKey } from '@douyinfe/semi-foundation/table/utils';


let scrollbarVerticalSize: number,
    scrollbarHorizontalSize: number;

// Measure scrollbar width for padding body during modal show/hide
const scrollbarMeasure = {
    position: 'absolute',
    top: '-9999px',
    width: '50px',
    height: '50px',
};

/**
 * @param {'vertical'|'horizontal'} [direction]
 * @returns {number}
 */
export function measureScrollbar(direction = 'vertical') {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
        return 0;
    }
    const isVertical = direction === 'vertical';
    if (isVertical && scrollbarVerticalSize) {
        return scrollbarVerticalSize;
    } else if (!isVertical && scrollbarHorizontalSize) {
        return scrollbarHorizontalSize;
    }
    const scrollDiv = document.createElement('div');
    Object.keys(scrollbarMeasure).forEach(scrollProp => {
        scrollDiv.style[scrollProp] = scrollbarMeasure[scrollProp];
    });
    // Append related overflow style
    if (isVertical) {
        scrollDiv.style.overflowY = 'scroll';
    } else {
        scrollDiv.style.overflowX = 'scroll';
    }
    document.body.appendChild(scrollDiv);
    let size = 0;
    if (isVertical) {
        // clientWidth is the inner width (excluding borders and scrollbars)
        // offsetWidth is the outer width (including padding and borders)
        size = scrollDiv.offsetWidth - scrollDiv.clientWidth;
        scrollbarVerticalSize = size;
    } else {
        size = scrollDiv.offsetHeight - scrollDiv.clientHeight;
        scrollbarHorizontalSize = size;
    }

    document.body.removeChild(scrollDiv);

    // console.log(size);

    return size;
}

export function amendTableWidth(tableWidth: number) {
    return typeof tableWidth === 'number' ?
        tableWidth -
              numbers.DEFAULT_CELL_PADDING_LEFT -
              numbers.DEFAULT_CELL_PADDING_RIGHT -
              numbers.DEFAULT_CELL_BORDER_WIDTH_LEFT -
              numbers.DEFAULT_CELL_BORDER_WIDTH_RIGHT -
              measureScrollbar('vertical') :
        undefined;
}

/**
 * The user can pass a component to define the rendering method of each level of the table
 * This function merges the components passed in by the user with the default components
 * @param {Object} components
 * @param {Boolean|Object} virtualized
 * @returns
 */
export function mergeComponents(components: TableComponents, virtualized: Virtualized) {
    return merge(
        {},
        {
            table: 'table',
            header: {
                outer: 'table',
                wrapper: 'thead',
                row: 'tr',
                cell: 'th',
            },
            body: virtualized ?
                {
                    outer: 'div',
                    wrapper: 'div',
                    row: 'div',
                    cell: 'div',
                    colgroup: {
                        wrapper: 'div',
                        col: 'div',
                    },
                } :
                {
                    outer: 'table',
                    wrapper: 'tbody',
                    row: 'tr',
                    cell: 'td',
                    colgroup: {
                        wrapper: 'colgroup',
                        col: 'col',
                    },
                },
            footer: {
                wrapper: 'tfoot',
                row: 'tr',
                cell: 'td',
            },
        },
        components
    );
}

export const logger = new Logger('[@douyinfe/semi-ui Table]');

export function mergeColumns(oldColumns: any[] = [], newColumns: any[] = [], keyPropNames: any[] = null, deep = true) {
    const finalColumns: any[] = [];
    const clone = deep ? cloneDeep : lodashClone;

    map(newColumns, newColumn => {
        newColumn = { ...newColumn };
        const key = getColumnKey(newColumn, keyPropNames);

        const oldColumn = key != null && find(oldColumns, item => getColumnKey(item, keyPropNames) === key);

        if (oldColumn) {
            finalColumns.push(
                clone({
                    ...oldColumn,
                    ...newColumn,
                })
            );
        } else {
            finalColumns.push(clone(newColumn));
        }
    });

    return finalColumns;
}

export function getNextSortOrder(sortOrder: string | boolean) {
    switch (sortOrder) {
        case strings.SORT_DIRECTIONS[0]:
            return strings.SORT_DIRECTIONS[1];
        case strings.SORT_DIRECTIONS[1]:
            return 'cancelSort';
        default: 
            return strings.SORT_DIRECTIONS[0];
    }
}

export { cloneDeep };
