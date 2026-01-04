import React from 'react';
import { RowProps } from '../grid/row';
import { ColProps } from '../grid/col';

export interface Grid extends RowProps, ColProps {}

export interface ListContextValue {
    onRightClick?: React.MouseEventHandler<HTMLLIElement>;
    onClick?: React.MouseEventHandler<HTMLLIElement>;
    grid?: Grid
}

const ListContext = React.createContext<ListContextValue>(null);

export default ListContext;