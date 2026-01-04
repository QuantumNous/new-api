import React from 'react';

export type DescriptionsAlign = 'center' | 'justify' | 'left' | 'plain';
export type DescriptionLayout = 'horizontal' | 'vertical'

export interface DescriptionsContextValue {
    align?: DescriptionsAlign;
    layout?: DescriptionLayout
}

const DescriptionsContext = React.createContext<DescriptionsContextValue>(null);

export default DescriptionsContext;