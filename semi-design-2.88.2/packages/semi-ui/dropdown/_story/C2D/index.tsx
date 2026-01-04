import React from "react";
import Dropdown from '../../index';
import Space from '../../../space';
import { IconBox } from "@douyinfe/semi-icons";

export function DropdownItem() {
    return (
        <Space vertical>
            <Dropdown.Item>Douyin</Dropdown.Item>
            <Dropdown.Item disabled>Douyin</Dropdown.Item>
            <Dropdown.Item hover>Douyin</Dropdown.Item>
            <Dropdown.Item showTick active>Douyin</Dropdown.Item>
            <Dropdown.Item icon={<IconBox />}>Douyin</Dropdown.Item>
        </Space>
    );
}