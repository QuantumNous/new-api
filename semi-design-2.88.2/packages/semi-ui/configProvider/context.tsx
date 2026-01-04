import React from 'react';
import { Locale } from '../locale/interface';

export interface ContextValue {
    direction?: 'ltr' | 'rtl';
    timeZone?: string | number;
    locale?: Locale;
    children?: React.ReactNode;
    getPopupContainer?(): HTMLElement
}

const ConfigContext = React.createContext<ContextValue>({});

export default ConfigContext;