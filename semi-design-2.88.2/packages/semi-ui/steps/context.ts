import React from 'react';

export interface ContextValue {
    type?: 'nav' | 'fill' | 'basic'
}

export default React.createContext<ContextValue>(null);