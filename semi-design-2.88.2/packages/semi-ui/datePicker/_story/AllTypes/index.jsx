import React, { useMemo, useState, useEffect } from 'react';
import DatePicker from '../../index';

const Item = ({ children }) => <div style={{ display: 'flex', marginBottom: 20 }}>{children}</div>;

function Demo() {
    return (
        <div>
            <Item>
                <DatePicker type={'dateTime'} format={'yyyy-MM-dd'} defaultValue={new Date()} />
            </Item>
            <Item>
                <DatePicker type={'dateTime'} format={'yyyy-MM-dd mm'} defaultValue={new Date()} />
            </Item>
        </div>
    );
}

export default Demo;
