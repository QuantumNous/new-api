import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { get } from 'lodash';
import { cssClasses } from '@douyinfe/semi-foundation/table/constants';
import { flattenColumns } from '@douyinfe/semi-foundation/table/utils';
import { ColumnProps, TableComponents } from './interface';

export interface ColGroupProps {
    columns?: ColumnProps[];
    prefixCls?: string;
    className?: string;
    style?: React.CSSProperties;
    components?: TableComponents['body']
}

export default class ColGroup extends React.PureComponent<ColGroupProps> {
    static propTypes = {
        columns: PropTypes.array,
        prefixCls: PropTypes.string,
        className: PropTypes.string,
        style: PropTypes.object,
        components: PropTypes.object,
    };

    static defaultProps = {
        columns: [] as [],
        prefixCls: cssClasses.PREFIX,
    };

    render() {
        const { columns, className, style, prefixCls, components } = this.props;

        const ColGroup = get(components, 'colgroup.wrapper', 'colgroup');
        const Col = get(components, 'colgroup.col', 'col');

        const cols = flattenColumns(columns).map((column: ColumnProps, idx: number) => {
            const colStyle: { width?: number | string; minWidth?: number | string } = {};

            /**
             * table width
             */
            if (column.width) {
                colStyle.width = column.width;
                colStyle.minWidth = colStyle.width;
            }

            return (
                <Col
                    className={classnames(`${prefixCls}-col`, column.className)}
                    key={column.key || column.dataIndex || idx}
                    style={colStyle}
                />
            );
        });

        const groupCls = classnames(`${prefixCls}-colgroup`, className);

        return (
            <ColGroup className={groupCls} style={style}>
                {cols}
            </ColGroup>
        );
    }
}
