import React from 'react';


export interface CollapseContextType{
    activeSet: Set<string>;
    expandIcon: React.ReactNode;
    collapseIcon: React.ReactNode;
    clickHeaderToExpand: boolean;
    keepDOM: boolean;
    expandIconPosition: 'left' | 'right';
    onClick: (activeKey: string, e: React.MouseEvent) => void;
    motion: boolean;
    lazyRender: boolean
}


const CollapseContext = React.createContext<CollapseContextType>({} as CollapseContextType);

export default CollapseContext;
