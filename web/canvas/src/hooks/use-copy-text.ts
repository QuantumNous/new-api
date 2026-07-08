"use client";

import { App } from "antd";
import copy from "copy-to-clipboard";

export function useCopyText() {
    const { message } = App.useApp();

    return (value: string, successText = "已复制") => {
        copy(value);
        message.success(successText);
    };
}
