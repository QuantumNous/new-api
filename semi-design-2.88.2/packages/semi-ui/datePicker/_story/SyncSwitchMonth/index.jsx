import React from 'react';
import DatePicker from '../../index';

export default function Demo() {
    return (
        <div>
            <div>
                <div> dateTimeRange类型 ，开启 syncSwitchMonth </div><br />
                <DatePicker
                    syncSwitchMonth={true}
                    type="dateTimeRange"
                    style={{ width: 340 }}
                />
                <br /><br />
            </div>
            <div>
                <div> dateTimeRange 类型，关闭 syncSwitchMonth </div><br />
                <DatePicker
                    syncSwitchMonth={false}
                    type="dateTimeRange"
                    style={{ width: 340 }}
                />
                <br /><br />
            </div>
            <div>
                <div> dateRange类型 ，开启 syncSwitchMonth </div><br />
                <DatePicker
                    syncSwitchMonth={true}
                    type="dateRange"
                    style={{ width: 340 }}
                />
                <br /><br />
            </div>
            <div>
                <div> dateRange类型 关闭 syncSwitchMonth </div><br />
                <DatePicker
                    syncSwitchMonth={false}
                    type="dateRange"
                    style={{ width: 340 }}
                />
                <br /><br />
            </div>
        </div>
    );
}
