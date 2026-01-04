import React from 'react';
import { TooltipProps } from '../tooltip/index';

export interface DropdownContextType {
    level?: number;
    showTick?: boolean;
    trigger?: TooltipProps['trigger']
}

const DropdownContext = React.createContext<DropdownContextType>({
    level: 0,
});
export default DropdownContext;
