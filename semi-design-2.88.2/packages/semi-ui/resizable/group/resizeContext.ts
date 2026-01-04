import React, { createContext, RefObject } from 'react';
import { ResizeCallback, ResizeEventType, ResizeStartCallback } from '@douyinfe/semi-foundation/resizable/types';

export interface ResizeContextProps {
    direction: 'horizontal' | 'vertical';
    registerItem: (ref: RefObject<HTMLDivElement>, 
        min: string, max: string, defaultSize: string|number,
        onResizeStart: ResizeStartCallback,
        onChange: ResizeCallback,
        onResizeEnd: ResizeCallback
    ) => number;
    registerHandler: (ref: RefObject<HTMLDivElement>) => number;
    notifyResizeStart: (handlerIndex: number, e: MouseEvent | Touch, type: ResizeEventType) => void;
    getGroupSize: () => number
}

export const ResizeContext = createContext<ResizeContextProps>(undefined);

