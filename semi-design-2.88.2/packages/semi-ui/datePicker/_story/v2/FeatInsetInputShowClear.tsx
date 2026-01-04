import React from "react";
import { DatePicker, Space, Input } from "@douyinfe/semi-ui";

export default function App() {
    const props = {
        insetInput: true,
        showClear: true,
        position: "topLeft"
    } as const;
    return (
        <Space vertical align="start">
            <DatePicker {...props} />
            <DatePicker {...props} type="dateRange" />
            <DatePicker {...props} type="dateTimeRange" />
        </Space>
    );
}