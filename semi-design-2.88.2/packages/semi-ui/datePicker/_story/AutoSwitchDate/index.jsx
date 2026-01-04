import React from 'react';
import { DatePicker } from '../../../index';

export default function Demo() {
    return (
        <div>
            <div>支持更改年月时不更新日期 v1.13.0</div><br/><br/>
            <h4>默认可以直接切换</h4>
            <DatePicker defaultValue={new Date()} onChange={console.log} /><br/><br/>
            <h4>用户可以关闭直接切换</h4>
            <DatePicker defaultValue={new Date()} autoSwitchDate={false} onChange={console.log}/><br/><br/>
        </div>
    );
}
