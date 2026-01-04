import React from 'react';

export const CustomH4 = ({ children }) => {
    return (
        <div style={{ fontSize: '19px', lineHeight: '40px', fontWeight: 500, }} >
            {children}
        </div>
    );
};

export const CustomH5 = ({ children }) => {
    return (
        <div style={{ fontSize: '16px', lineHeight: '28px', fontWeight: 500, }}>
            {children}
        </div>
    );
};
