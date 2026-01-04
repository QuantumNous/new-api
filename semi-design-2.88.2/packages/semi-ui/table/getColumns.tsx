import React from 'react';
import Column from './Column';
import { get, omit } from 'lodash';
import { ColumnProps } from './interface';

/**
 * Convert jsx children into object columns
 * @param {Node} children
 * @returns
 */
export default function getColumns(children: React.ReactNode) {
    if (children) {
        const columns: ColumnProps[] = [];

        React.Children.forEach(children, child => {
            if (React.isValidElement(child) && (child.type === Column || get(child, 'type.elementType') === 'Column')) {
                const col = omit(child.props, ['children']);

                if (Array.isArray(child.props.children) && child.props.children.length) {
                    col.children = getColumns(child.props.children);
                }

                columns.push({
                    key: child.key,
                    ...col,
                });
            }
        });

        return columns;
    }

    return [];
}
