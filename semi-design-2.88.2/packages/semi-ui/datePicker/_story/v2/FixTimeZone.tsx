import React, { useMemo, useState } from "react";
import { Select, DatePicker } from "@douyinfe/semi-ui";

export default function Demo(props = {}) {
    const defaultTimestamp = 1581599305265;
    const [timeZone, setTimeZone] = useState("GMT+00:00");
    const [value, setValue] = useState(defaultTimestamp);
    const [dateValue, setDateValue] = useState();

    const gmtList = useMemo(() => {
        const list = [];
        for (let hourOffset = -11; hourOffset <= 14; hourOffset++) {
            const prefix = hourOffset >= 0 ? "+" : "-";
            const hOffset = Math.abs(parseInt(hourOffset, 10));
            list.push(`GMT${prefix}${String(hOffset).padStart(2, "0")}:00`);
        }
        return list;
    }, []);

    const handleChange = (date) => {
        if (date instanceof Date) {
            const timeStamp = date.valueOf();
            console.log(date, timeStamp);
            setValue(timeStamp);
            setDateValue(date);
        }
    };

    return (
        <div style={{ width: 300 }}>
            <h5 style={{ margin: 10 }}>Select Time Zone:</h5>
            <Select
                placeholder={"请选择时区"}
                style={{ width: 300 }}
                value={timeZone}
                showClear={true}
                onSelect={(value) => setTimeZone(value)}
            >
                {gmtList.map((gmt) => (
                    <Select.Option key={gmt} value={gmt}>
                        {gmt}
                    </Select.Option>
                ))}
            </Select>
            <br />
            <br />
            <DatePicker
                timeZone={timeZone}
                type={"dateTime"}
                // value={value}
                value={dateValue}
                onChange={handleChange}
            />
        </div>
    );
}
