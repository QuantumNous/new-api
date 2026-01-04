import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import cls from 'classnames';
import { noop } from 'lodash';
import { IconCaretup, IconCaretdown } from '@douyinfe/semi-icons';

import { cssClasses, strings } from '@douyinfe/semi-foundation/table/constants';

import { SortIcon, SortOrder, TableLocale } from './interface';
import Tooltip from '../tooltip';
import isEnterPress from '@douyinfe/semi-foundation/utils/isEnterPress';
import { getNextSortOrder } from './utils';
import LocaleConsumer from '../locale/localeConsumer';

export interface ColumnSorterProps {
    className?: string;
    style?: React.CSSProperties;
    onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
    prefixCls?: string;
    sortOrder?: SortOrder;
    title?: React.ReactNode;
    sortIcon?: SortIcon;
    showTooltip?: boolean
}

export default class ColumnSorter extends PureComponent<ColumnSorterProps> {
    static propTypes = {
        className: PropTypes.string,
        style: PropTypes.object,
        onClick: PropTypes.func,
        prefixCls: PropTypes.string,
        sortOrder: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
        sortIcon: PropTypes.func,
        showTooltip: PropTypes.bool,
    };

    static defaultProps = {
        prefixCls: cssClasses.PREFIX,
        onClick: noop,
        sortOrder: false,
        showTooltip: false
    };

    render() {
        const { prefixCls, onClick, sortOrder, style, title, sortIcon, showTooltip } = this.props;

        const iconBtnSize = 'default';

        const upCls = cls(`${prefixCls}-column-sorter-up`, {
            on: sortOrder === strings.SORT_DIRECTIONS[0],
        });

        const downCls = cls(`${prefixCls}-column-sorter-down`, {
            on: sortOrder === strings.SORT_DIRECTIONS[1],
        });
        const ariaProps = {
            /**
             * Set 'aria-sort' to aria-columnheader is difficult, so set 'aria-label' about sort info to sorter
             * reference: https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaSort
             */
            'aria-label': `Current sort order is ${sortOrder ? `${sortOrder}ing` : 'none'}`,
            'aria-roledescription': 'Sort data with this column',
        };

        const renderSortIcon = () => {
            if (typeof sortIcon === 'function') {
                return sortIcon({ sortOrder });
            } else {
                const node = (<div style={style} className={`${prefixCls}-column-sorter`}>
                    <span className={`${upCls}`}>
                        <IconCaretup size={iconBtnSize} />
                    </span>
                    <span className={`${downCls}`}>
                        <IconCaretdown size={iconBtnSize} />
                    </span>
                </div>);
                if (showTooltip) {
                    let content = getNextSortOrder(sortOrder);
                    return (<LocaleConsumer 
                        componentName="Table" 
                    >
                        {(locale: TableLocale, localeCode: string) => (
                            <Tooltip content={locale[content]}>
                                {node}
                            </Tooltip>
                        )}
                    </LocaleConsumer>);
                }
                return node;
            }
        };

        return (
            <div
                role="button"
                {...ariaProps}
                tabIndex={-1}
                className={`${prefixCls}-column-sorter-wrapper`}
                onClick={onClick}
                onKeyPress={e => isEnterPress(e) && onClick(e as any)}
            >
                {title}
                {renderSortIcon()}
            </div>
        );
    }
}
