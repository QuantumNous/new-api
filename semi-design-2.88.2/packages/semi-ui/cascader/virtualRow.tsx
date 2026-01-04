import React from 'react';

export interface VirtualRowProps{
    index: number;
    data: Record<string, any>;
    style?: React.CSSProperties
}

const VirtualRow = ({ index, data, style }: VirtualRowProps) => {
    const { visibleOptions, renderOption } = data;
    const option = visibleOptions[index];
    return renderOption(option, index, style);
};

export default VirtualRow;
