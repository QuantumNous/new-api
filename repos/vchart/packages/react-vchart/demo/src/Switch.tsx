import React, { useRef, useState, useCallback } from 'react';

const baseStyle = { margin: 0 };

const Switch = (props: { data: string[]; currentActive: string; onChange: (entry: string, index: number) => void }) => {
  const { data, currentActive, onChange } = props;

  const handleClick = useCallback(
    (entry: string, index: number) => {
      onChange(entry, index);
      console.log('switch click', entry, index);
    },
    [onChange]
  );

  return (
    <div style={{ display: 'flex' }}>
      {data.map((entry, index) => {
        return (
          <p
            key={`entry-${index}`}
            style={currentActive === entry ? { ...baseStyle, color: 'black' } : { ...baseStyle, color: '#666' }}
            onClick={handleClick.bind(null, entry, index)}
          >
            {index > 0 ? ` | ${entry}` : entry}
          </p>
        );
      })}
    </div>
  );
};

export default Switch;
