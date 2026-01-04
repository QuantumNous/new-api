import React from 'react';
import Calendar from '../index';

const Demo = () => {
    return (
        <div>
            <Calendar
                height="1200"
                onClick={(ev: any) => {
                    console.log(ev);
                }}
                showCurrTime
                markWeekend>

            </Calendar>
        </div>
    );
};

export default Demo;