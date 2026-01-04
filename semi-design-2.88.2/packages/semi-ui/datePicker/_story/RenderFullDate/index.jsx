import React from 'react';
import { DatePicker, Space } from '@douyinfe/semi-ui';
import classNames from 'classnames';
import '@douyinfe/semi-foundation/datePicker/datePicker.scss'; 
import './index.scss';

/**
 * 开启 Chromatic UI 测试
 */
export default function Demo() {
    const dayStyle = {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        margin: '0 auto',
        boxSizing: 'border-box',
        borderRadius: '50%',
    };

    const renderFullDate = (dayNumber, fullDate, dayStatus) => {
        const { isToday, isInRange, isHover, isSelected, isSelectedStart, isSelectedEnd, isDisabled } = dayStatus;
        const prefix = 'components-datepicker-demo';
        const dateCls = classNames({
            [`${prefix}-day-today`]: isToday,
            [`${prefix}-day-inrange`]: isInRange,
            [`${prefix}-day-hover`]: isHover,
            [`${prefix}-day-selected`]: isSelected,
            [`${prefix}-day-selected-start`]: isSelectedStart,
            [`${prefix}-day-selected-end`]: isSelectedEnd,
            [`${prefix}-day-disabled`]: isDisabled,
        });
        return (
            <div style={dayStyle} className={dateCls}>
                {dayNumber}
            </div>
        );
    };
    const props = {
        defaultOpen: true,
        position: 'bottomLeft',
        autoAdjustOverflow: false,
        motion: false,
    };
    const singleDefaultValue = new Date('2021-01-08');
    const multipleDefaultValue = [new Date('2021-01-08'), new Date('2021-01-09'), new Date('2021-01-10'), new Date('2021-01-19')];
    const rangeDefaultValue = [new Date('2021-12-08'), new Date('2021-01-20')];

    return (
        <div style={{ height: '100vh' }}>
            <div>
                通过 renderFullDate 可以自定义日期单元格子的渲染，API 提供日期的当前状态：是否被选中，是否是当前日等。
            </div>  
            <Space wrap spacing={[12, 400]}>
                <div>
                    单选选中
                    <DatePicker {...props} style={{ width: '230px' }} renderFullDate={renderFullDate} defaultValue={singleDefaultValue} />
                </div>
                <div>
                    多选选中
                    <DatePicker {...props} style={{ width: '230px' }} multiple={true} renderFullDate={renderFullDate} defaultValue={multipleDefaultValue} />
                </div>
                <div>
                    范围选中
                    <DatePicker {...props} style={{ width: '230px' }} type={'dateRange'} renderFullDate={renderFullDate} defaultValue={rangeDefaultValue} />
                </div>
            </Space>
        </div>
    );
}
Demo.parameters = {
    chromatic: {
        disableSnapshot: false,
        delay: 3000,
        viewports: [1800]
    },
};