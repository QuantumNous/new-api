import React from 'react';
import PropTypes from 'prop-types';
import NormalTable from './Table';
import ResizableTable from './ResizableTable';
import Column from './Column';
import { strings } from '@douyinfe/semi-foundation/table/constants';
import { TableProps, Data } from './interface';
import ConfigContext, { ContextValue } from '../configProvider/context';

class Table<RecordType extends Record<string, any> = Data> extends React.PureComponent<TableProps<RecordType>> {
    static Column = Column;
    static DEFAULT_KEY_COLUMN_SELECTION = strings.DEFAULT_KEY_COLUMN_SELECTION;
    static DEFAULT_KEY_COLUMN_EXPAND = strings.DEFAULT_KEY_COLUMN_EXPAND;

    static propTypes = {
        ...NormalTable.propTypes,
        resizable: PropTypes.oneOfType([PropTypes.bool, PropTypes.object]),
    };

    static defaultProps = {
        hideExpandedColumn: true,
    };

    static contextType = ConfigContext;

    tableRef: React.RefObject<NormalTable<RecordType>>;
    context: ContextValue;
    constructor(props: TableProps) {
        super(props);
        this.tableRef = React.createRef();
    }

    getCurrentPageData = () => this.tableRef.current && this.tableRef.current.getCurrentPageData();

    render() {
        // eslint-disable-next-line prefer-destructuring
        const props = this.props;
        const direction = this.props.direction ?? this.context.direction;
        if (props.resizable) {
            return <ResizableTable {...props} ref={this.tableRef} direction={direction} />;
        } else {
            return <NormalTable<RecordType> {...props} ref={this.tableRef} direction={direction} />;
        }
    }
}

export * from './interface';

export default Table;
