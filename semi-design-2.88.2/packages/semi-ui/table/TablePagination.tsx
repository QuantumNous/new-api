import React, { PureComponent, isValidElement } from 'react';
import PropTypes from 'prop-types';
import { get, isFunction } from 'lodash';

import { cssClasses } from '@douyinfe/semi-foundation/table/constants';
import Pagination from '../pagination';
import { RenderPagination, TablePaginationProps as PaginationProps } from './interface';

export interface TablePaginationProps {
    style?: React.CSSProperties;
    prefixCls?: string;
    pagination?: PaginationProps;
    info?: React.ReactNode;
    renderPagination?: RenderPagination
}

export default class TablePagination extends PureComponent<TablePaginationProps> {

    static propTypes = {
        style: PropTypes.object,
        prefixCls: PropTypes.string,
        pagination: PropTypes.object,
        info: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
        renderPagination: PropTypes.func,
    };

    static defaultProps = {
        prefixCls: cssClasses.PREFIX,
    };

    render() {
        const { pagination, prefixCls, info, renderPagination } = this.props;
        const total = get(pagination, 'total');
        const customPagination = renderPagination && isFunction(renderPagination) ? renderPagination(pagination) : null;

        return (
            <div className={`${prefixCls}-pagination-outer`}>
                {
                    isValidElement(customPagination) ? customPagination : (
                        <>
                            <span className={`${prefixCls}-pagination-info`}>{info}</span>
                            <span className={`${prefixCls}-pagination-wrapper`}>
                                {total > 0 ? <Pagination {...pagination} key={get(pagination, 'pageSize', 'pagination')} /> : null}
                            </span>
                        </>
                    )
                }
            </div>
        );
    }
}
