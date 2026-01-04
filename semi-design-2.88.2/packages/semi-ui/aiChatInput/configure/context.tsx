import React from 'react';

interface ConfigureContextType {
    value: any;
    onChange: (value: any, init?: boolean) => void;
    onRemove: (field: string) => void
}

const Context = React.createContext<ConfigureContextType>({} as any);
export { Context, ConfigureContextType };
