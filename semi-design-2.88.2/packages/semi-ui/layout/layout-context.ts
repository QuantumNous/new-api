import React from 'react';
import { noop } from '@douyinfe/semi-foundation/utils/function';

export interface ContextType {
    siderHook: {
        addSider: (id: string) => void;
        removeSider: (id: string) => void
    }
}

const LayoutContext = React.createContext<ContextType>({
    siderHook: {
        addSider: noop,
        removeSider: noop,
    },
});

export default LayoutContext;
