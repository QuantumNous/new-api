import React from 'react';
import DatePicker, { PresetsType } from '../../index';

/**
 * test with cypress, please don't modify this story
 */
export default function App() {
    const presets: PresetsType = [
        {
            text: '动态时间',
            start: () => new Date('2024-01-24'),
            end: () => new Date('2024-02-26'),
        },
    ];
    return (
        <div>
            <h4>presets start 和 end 使用函数类型</h4>
            <div>
                <DatePicker type="dateRange" presets={presets} />
            </div>
        </div>
    );
}
