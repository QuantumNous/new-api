import React from 'react';
import ColumnShape from './ColumnShape';
import { ColumnProps, Data } from './interface';

export default class Column<RecordType extends Record<string, any> = Data> extends React.PureComponent<ColumnProps<RecordType>> {
    static propTypes = {
        ...ColumnShape,
    };

    static elementType = 'Column';

    constructor(props: ColumnProps = {}) {
        super(props);
    }

    render(): null {
        return null;
    }
}
